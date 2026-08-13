/**
 * Guards the migration history before a deploy touches a production database.
 *
 * `prisma migrate deploy` applies whatever it finds and records a checksum per migration. That
 * makes two edits fatal in ways nothing catches at review time: changing a migration that has
 * already run (the checksum no longer matches and every later deploy fails with P3005/P3009), and
 * changing the schema without generating a migration (the deploy succeeds, the column is missing,
 * and the failure lands at runtime). Both are cheap to detect here.
 *
 *   npm run db:validate                    # structure + destructive scan + history vs origin/main
 *   npm run db:validate -- --base HEAD~1   # compare against a different ref
 *   SHADOW_DATABASE_URL=... npm run db:validate   # adds the schema-vs-migrations drift check
 *
 * Exit code 1 means do not deploy.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");
/** Forward slashes on purpose: this is compared against git output, which never uses backslashes. */
const SCHEMA_PATH = "prisma/schema.prisma";

/** Prisma names a migration `<14-digit timestamp>_<snake_case label>`. */
const MIGRATION_NAME = /^\d{14}_[a-z0-9]+(?:_[a-z0-9]+)*$/;

interface Finding {
  level: "error" | "warning";
  message: string;
  detail?: string;
}

const findings: Finding[] = [];

const fail = (message: string, detail?: string): void => {
  findings.push({ level: "error", message, detail });
};

const warn = (message: string, detail?: string): void => {
  findings.push({ level: "warning", message, detail });
};

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

/** Runs a command for its output, returning null instead of throwing when it fails. */
const run = (command: string, args: string[]): string | null => {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
};

const listMigrations = (): string[] => {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

// ── 1. Structure ─────────────────────────────────────────────────────────────
// A folder Prisma cannot read is a deploy that stops halfway, so the shape is checked first.

const checkStructure = (migrations: string[]): void => {
  const lockPath = path.join(MIGRATIONS_DIR, "migration_lock.toml");

  if (!fs.existsSync(lockPath)) {
    fail("prisma/migrations/migration_lock.toml is missing", "Commit it - Prisma refuses to deploy a migrations directory without the provider lock.");
  } else if (!fs.readFileSync(lockPath, "utf8").includes('provider = "postgresql"')) {
    fail("migration_lock.toml does not declare the postgresql provider", "The lock and the datasource must agree, or `migrate deploy` aborts.");
  }

  for (const name of migrations) {
    if (!MIGRATION_NAME.test(name)) {
      fail(`Migration folder "${name}" is not named the way Prisma names them`, "Expected <14-digit timestamp>_<snake_case label>, e.g. 20260811000000_add_user_role.");
    }

    const sqlPath = path.join(MIGRATIONS_DIR, name, "migration.sql");

    if (!fs.existsSync(sqlPath)) {
      fail(`Migration "${name}" has no migration.sql`);
      continue;
    }

    if (fs.readFileSync(sqlPath, "utf8").trim().length === 0) {
      fail(`Migration "${name}" is empty`, "An empty migration still takes a slot in the history; delete the folder instead.");
    }

    // A `*.sql` line in .gitignore silently swallows migrations: the folder exists locally, the
    // deploy checks out a tree without it, and the column is simply missing in production.
    if (run("git", ["check-ignore", "-q", path.posix.join("prisma/migrations", name, "migration.sql")]) !== null) {
      fail(`Migration "${name}" is ignored by .gitignore`, "It will never reach the server. Add `!prisma/migrations/**/*.sql` to .gitignore.");
    }
  }

  const duplicateTimestamps = new Map<string, string[]>();
  for (const name of migrations) {
    const stamp = name.slice(0, 14);
    duplicateTimestamps.set(stamp, [...(duplicateTimestamps.get(stamp) ?? []), name]);
  }

  for (const [stamp, names] of duplicateTimestamps) {
    // Two branches generating a migration in the same second order arbitrarily on the server.
    if (names.length > 1) fail(`Two migrations share the timestamp ${stamp}`, names.join(", "));
  }
};

// ── 2. History immutability ──────────────────────────────────────────────────
// Migrations already merged have already run somewhere. Editing one is the single most common way
// to break a production deploy, and git is the only place it is visible before the deploy.

const checkHistory = (base: string): { changedSchema: boolean; addedMigrations: string[] } => {
  const inGitRepo = run("git", ["rev-parse", "--is-inside-work-tree"]) === "true";

  if (!inGitRepo) {
    warn("Not a git repository - skipping the history check", "Editing an already-applied migration cannot be detected without git.");
    return { changedSchema: false, addedMigrations: [] };
  }

  if (run("git", ["rev-parse", "--verify", "--quiet", base]) === null) {
    warn(`Base ref "${base}" is not available - skipping the history check`, "In CI, fetch the base branch (actions/checkout with fetch-depth: 0) so this check can run.");
    return { changedSchema: false, addedMigrations: [] };
  }

  const diff = run("git", ["diff", "--name-status", "--find-renames", `${base}...HEAD`]) ?? run("git", ["diff", "--name-status", "--find-renames", base]) ?? "";

  const rows = diff
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t");
      return { status, from: paths[0], to: paths[paths.length - 1] };
    });

  // Work that is not committed yet counts too: run locally, before the commit, is exactly when a
  // hand-edited migration is still cheap to undo.
  for (const line of (run("git", ["status", "--porcelain", "--untracked-files=all"]) ?? "").split("\n").filter(Boolean)) {
    const code = line.slice(0, 2);
    const filePath = line.slice(3).replace(/^"|"$/g, "").split(" -> ").pop() as string;

    const status = code.includes("?") || code.includes("A") ? "A" : code.includes("D") ? "D" : code.includes("R") ? "R" : "M";
    rows.push({ status, from: filePath, to: filePath });
  }

  const addedMigrations: string[] = [];

  for (const row of rows) {
    const touchesMigration = row.from.startsWith("prisma/migrations/") || row.to.startsWith("prisma/migrations/");
    if (!touchesMigration) continue;

    const name = (row.to.startsWith("prisma/migrations/") ? row.to : row.from).split("/")[2];

    if (row.status.startsWith("A")) {
      if (row.to.endsWith("migration.sql")) addedMigrations.push(name);
      continue;
    }

    if (row.status.startsWith("M")) {
      fail(`Migration "${name}" was modified`, "It may already have been applied; Prisma stores a checksum and every later `migrate deploy` will fail. Add a new migration instead.");
      continue;
    }

    if (row.status.startsWith("D")) {
      fail(`Migration "${name}" was deleted`, "The database still has the row in _prisma_migrations. Add a new migration that reverses it instead.");
      continue;
    }

    if (row.status.startsWith("R")) {
      fail(`Migration "${name}" was renamed`, "The name is the key Prisma records; renaming it makes the applied migration look missing.");
    }
  }

  const changedSchema = rows.some((row) => row.to === SCHEMA_PATH || row.from === SCHEMA_PATH);

  if (changedSchema && addedMigrations.length === 0) {
    fail("prisma/schema.prisma changed but no migration was added", "Run `npm run db:migrate` locally and commit the generated folder - `migrate deploy` only applies what is committed.");
  }

  if (!changedSchema && addedMigrations.length > 0) {
    warn("A migration was added without a schema change", "Fine for a data backfill or a hand-written index; worth a second look otherwise.");
  }

  return { changedSchema, addedMigrations };
};

// ── 3. Destructive statements ────────────────────────────────────────────────
// These are legitimate, but they are also unrecoverable without a restore, so a deploy should never
// carry one by accident.

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\bDROP\s+TABLE\b/i, what: "drops a table" },
  { pattern: /\bDROP\s+COLUMN\b/i, what: "drops a column" },
  { pattern: /\bDROP\s+SCHEMA\b/i, what: "drops a schema" },
  { pattern: /\bDROP\s+TYPE\b/i, what: "drops an enum type" },
  { pattern: /\bTRUNCATE\b/i, what: "truncates a table" },
  { pattern: /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\s+TO\b/i, what: "renames a table (old name disappears in the same instant the code expects the new one)" },
  { pattern: /\bALTER\s+COLUMN\b[\s\S]*?\bSET\s+NOT\s+NULL\b/i, what: "adds NOT NULL to an existing column (fails outright if any row holds null)" },
  { pattern: /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i, what: "changes a column type (can silently lose precision)" },
];

/** `ADD COLUMN x TEXT NOT NULL` with no default fails on any table that already has rows. */
const NOT_NULL_WITHOUT_DEFAULT = /\bADD\s+COLUMN\b[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)[^;]*;/gi;

const stripComments = (sql: string): string => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const checkDestructive = (migrations: string[], onlyThese: string[]): void => {
  const allowed = process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "true" || hasFlag("allow-destructive");
  const scope = onlyThese.length > 0 ? migrations.filter((name) => onlyThese.includes(name)) : migrations;

  for (const name of scope) {
    const sqlPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const sql = stripComments(fs.readFileSync(sqlPath, "utf8"));
    const record = allowed ? warn : fail;

    for (const { pattern, what } of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(sql)) {
        record(
          `Migration "${name}" ${what}`,
          allowed
            ? "Allowed by ALLOW_DESTRUCTIVE_MIGRATIONS - take a database backup before deploying."
            : "Set ALLOW_DESTRUCTIVE_MIGRATIONS=true on the run once you have a backup and have confirmed no released code still reads it.",
        );
      }
    }

    for (const statement of sql.match(NOT_NULL_WITHOUT_DEFAULT) ?? []) {
      record(`Migration "${name}" adds a NOT NULL column without a default`, `${statement.replace(/\s+/g, " ").trim()} - this fails on a table that already holds rows. Add a DEFAULT, or backfill in a separate migration first.`);
    }
  }
};

// ── 4. Drift ─────────────────────────────────────────────────────────────────
// The definitive check: replay every migration into a scratch database and compare the result with
// schema.prisma. Needs a database, so it only runs where one is configured.

const checkDrift = (): void => {
  if (!process.env.SHADOW_DATABASE_URL) {
    warn("SHADOW_DATABASE_URL is not set - skipping the schema/migrations drift check", "Point it at a scratch database (CI does) to verify the migrations really produce schema.prisma.");
    return;
  }

  const args = ["prisma", "migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema", SCHEMA_PATH, "--exit-code"];

  try {
    execFileSync("npx", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    console.log("  ✓ migrations replay into exactly the schema in schema.prisma");
  } catch (error) {
    const { status, stdout, stderr } = error as { status?: number; stdout?: string; stderr?: string };

    if (status === 2) {
      fail("The migrations do not add up to schema.prisma", `${(stdout ?? "").trim()}\n     Run \`npm run db:migrate\` to generate the missing migration.`);
      return;
    }

    warn("Could not run the drift check", (stderr ?? stdout ?? "").trim() || "prisma migrate diff failed.");
  }
};

// ── Report ───────────────────────────────────────────────────────────────────

const main = (): void => {
  const base = arg("base") ?? process.env.MIGRATION_BASE_REF ?? "origin/main";

  console.log("🔎 Validating migrations\n");

  const migrations = listMigrations();
  console.log(`  • ${migrations.length} migration${migrations.length === 1 ? "" : "s"} in prisma/migrations`);
  console.log(`  • comparing against ${base}\n`);

  checkStructure(migrations);
  const { addedMigrations } = checkHistory(base);
  // Only what this change introduces is scanned for destructive SQL - the history is already
  // deployed, and flagging it forever would train everyone to ignore the check.
  checkDestructive(migrations, addedMigrations);
  checkDrift();

  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warning");

  for (const finding of warnings) {
    console.log(`  ⚠ ${finding.message}`);
    if (finding.detail) console.log(`     ${finding.detail}`);
  }

  for (const finding of errors) {
    console.log(`  ✗ ${finding.message}`);
    if (finding.detail) console.log(`     ${finding.detail}`);
  }

  console.log("");

  if (errors.length > 0) {
    console.log(`❌ ${errors.length} problem${errors.length === 1 ? "" : "s"} - do not deploy.\n`);
    process.exit(1);
  }

  if (addedMigrations.length > 0) {
    console.log(`✅ Migrations look safe to deploy (new: ${addedMigrations.join(", ")}).\n`);
  } else {
    console.log("✅ Migrations look safe to deploy (nothing new in this change).\n");
  }
};

main();

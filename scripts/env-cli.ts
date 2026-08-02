import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decryptValue, encryptValue, ENV_FILE, generateKey, isEncrypted, KEY_ENV_NAME, KEY_FILE, parseEnv, quoteIfNeeded, resolveKey } from "./env-crypto";

const CWD = process.cwd();
const envPath = path.join(CWD, ENV_FILE);
const backupPath = path.join(CWD, `${ENV_FILE}.bak`);

const readEnv = (): string => {
  if (!existsSync(envPath)) {
    console.error(`✖ No ${ENV_FILE} found in ${CWD}`);
    process.exit(1);
  }
  return readFileSync(envPath, "utf8");
};

const transform = (direction: "encrypt" | "decrypt") => {
  const key = resolveKey(CWD);
  const lines = parseEnv(readEnv());

  let changed = 0;
  let untouched = 0;

  const output = lines.map((line) => {
    if (!line.name || line.value === undefined || line.prefix === undefined) return line.raw;

    const sealed = isEncrypted(line.value);

    if ((direction === "encrypt" && sealed) || (direction === "decrypt" && !sealed)) {
      untouched += 1;
      return line.raw;
    }

    try {
      const next = direction === "encrypt" ? encryptValue(line.value, key) : quoteIfNeeded(decryptValue(line.value, key));
      changed += 1;
      return `${line.prefix}${next}`;
    } catch {
      console.error(`✖ ${line.name}: could not ${direction}. Wrong key?`);
      process.exit(1);
    }
  });

  if (changed === 0) {
    console.log(`Nothing to ${direction} — ${untouched} value(s) already in that state.`);
    return;
  }

  copyFileSync(envPath, backupPath);
  writeFileSync(envPath, output.join("\n"), "utf8");

  console.log(`✔ ${direction === "encrypt" ? "Encrypted" : "Decrypted"} ${changed} value(s)${untouched ? `, left ${untouched} untouched` : ""}`);
  console.log(`  A copy of the previous file is in ${ENV_FILE}.bak — delete it once you are happy, it still holds the old values.`);
  console.log("  Restart any running dev server: it reloads .env on change but not the decryption step.");
};

const status = () => {
  const lines = parseEnv(readEnv());
  const assignments = lines.filter((line) => line.name && line.value !== undefined);

  if (assignments.length === 0) {
    console.log(`${ENV_FILE} has no values.`);
    return;
  }

  const sealed = assignments.filter((line) => isEncrypted(line.value as string));

  console.log(`${ENV_FILE}: ${sealed.length}/${assignments.length} value(s) encrypted\n`);
  for (const line of assignments) {
    console.log(`  ${isEncrypted(line.value as string) ? "🔒" : "  "} ${line.name}`);
  }

  const key = resolveKey(CWD, { optional: true });
  console.log(`\nkey: ${key ? "found" : `missing — set ${KEY_ENV_NAME} or create ${KEY_FILE}`}`);
};

const createKey = () => {
  const keyPath = path.join(CWD, KEY_FILE);

  if (existsSync(keyPath)) {
    console.error(`✖ ${KEY_FILE} already exists. Delete it first if you really mean to rotate the key —`);
    console.error("  anything encrypted with the old key can only be opened with the old key.");
    process.exit(1);
  }

  writeFileSync(keyPath, `${generateKey()}\n`, "utf8");

  console.log(`✔ Wrote ${KEY_FILE}`);
  console.log(`  It is git-ignored. Keep it out of ${ENV_FILE} — that is the file it unlocks.`);
  console.log(`  On a server, pass the same value as ${KEY_ENV_NAME} instead of shipping the file.`);
};

const command = process.argv[2];

switch (command) {
  case "encrypt":
    transform("encrypt");
    break;
  case "decrypt":
    transform("decrypt");
    break;
  case "status":
    status();
    break;
  case "key":
    createKey();
    break;
  default:
    console.error("Usage: tsx scripts/env-cli.ts <encrypt|decrypt|status|key>");
    process.exit(1);
}

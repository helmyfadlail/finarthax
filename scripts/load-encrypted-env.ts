import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { decryptValue, ENV_FILE, isEncrypted, KEY_ENV_NAME, KEY_FILE, parseEnv, resolveKey } from "./env-crypto";

const assertEnvFileIsSealed = (cwd: string): void => {
  const file = path.join(cwd, ENV_FILE);
  if (!existsSync(file)) return;

  const plain = parseEnv(readFileSync(file, "utf8"))
    .filter((line) => line.name && line.value !== undefined && !isEncrypted(line.value))
    .map((line) => line.name as string);

  if (plain.length === 0) return;

  const listed = plain.slice(0, 5).join(", ") + (plain.length > 5 ? `, +${plain.length - 5} more` : "");

  throw new Error(
    `${ENV_FILE} holds ${plain.length} value(s) in plain text: ${listed}\n` +
      `This app only runs with an encrypted ${ENV_FILE}. Seal it with:\n` +
      `  npm run env:key   # once, if you have no ${KEY_FILE} yet\n` +
      `  npm run encrypt\n` +
      `(Deployments that pass settings through the environment instead of a ${ENV_FILE} file are unaffected.)`,
  );
};

export function loadEncryptedEnv(): void {
  assertEnvFileIsSealed(process.cwd());

  const sealed = Object.entries(process.env).filter(([, value]) => typeof value === "string" && isEncrypted(value));

  if (sealed.length === 0) return;

  const key = resolveKey(process.cwd(), { optional: true });

  if (!key) {
    throw new Error(
      `${sealed.length} environment value(s) are encrypted but no key was found.\n` + `Set ${KEY_ENV_NAME} or create a ${KEY_FILE} file, or run "npm run decrypt" to store them in plain text.`,
    );
  }

  for (const [name, value] of sealed) {
    try {
      process.env[name] = decryptValue(value as string, key);
    } catch {
      throw new Error(`Could not decrypt ${name}. The key does not match the value in ${ENV_FILE}.`);
    }
  }
}

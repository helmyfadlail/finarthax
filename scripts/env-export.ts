import { decryptValue, isEncrypted, KEY_ENV_NAME, KEY_FILE, resolveKey } from "./env-crypto";

const sealed = Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string" && isEncrypted(entry[1]));

if (sealed.length === 0) process.exit(0);

const key = resolveKey(process.cwd(), { optional: true });

if (!key) {
  console.error(`${sealed.length} environment value(s) are encrypted but no key was found. Set ${KEY_ENV_NAME} or provide ${KEY_FILE}.`);
  process.exit(1);
}

const shellQuote = (value: string): string => `'${value.split("'").join(`'\\''`)}'`;

for (const [name, value] of sealed) {
  try {
    console.log(`export ${name}=${shellQuote(decryptValue(value, key))}`);
  } catch {
    console.error(`Could not decrypt ${name}. The key does not match.`);
    process.exit(1);
  }
}

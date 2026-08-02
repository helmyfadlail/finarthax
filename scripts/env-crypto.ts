import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_SALT = "finarthax.env.v1";

export const KEY_FILE = ".env.key";
export const ENV_FILE = ".env";
export const KEY_ENV_NAME = "ENV_ENCRYPTION_KEY";

const isGeneratedKey = (value: string): boolean => /^[A-Za-z0-9+/]{43}=$/.test(value);

export const generateKey = (): string => randomBytes(KEY_LENGTH).toString("base64");

const readKeyFile = (cwd: string): string | null => {
  const file = path.join(cwd, KEY_FILE);
  if (!existsSync(file)) return null;

  const contents = readFileSync(file, "utf8").trim();
  if (!contents) return null;

  const match = contents.match(/^(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*)?(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
};

export function resolveKey(cwd?: string): Buffer;
export function resolveKey(cwd: string, options: { optional: true }): Buffer | null;
export function resolveKey(cwd: string = process.cwd(), options: { optional?: boolean } = {}): Buffer | null {
  const raw = process.env[KEY_ENV_NAME]?.trim() || readKeyFile(cwd);

  if (!raw) {
    if (options.optional) return null;
    throw new Error(`No encryption key found. Set ${KEY_ENV_NAME} or create a ${KEY_FILE} file — run "npm run env:key" to generate one.`);
  }

  return isGeneratedKey(raw) ? Buffer.from(raw, "base64") : scryptSync(raw, SCRYPT_SALT, KEY_LENGTH);
}

export const isEncrypted = (value: string): boolean => value.startsWith(PREFIX);

export const encryptValue = (plainText: string, key: Buffer): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);

  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
};

export const decryptValue = (value: string, key: Buffer): string => {
  const payload = Buffer.from(value.slice(PREFIX.length), "base64");

  if (payload.length <= IV_LENGTH + TAG_LENGTH) throw new Error("Encrypted value is malformed");

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const cipherText = payload.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
};

export interface EnvLine {
  raw: string;
  name?: string;
  value?: string;
  prefix?: string;
}

const ASSIGNMENT = /^(\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=)(.*)$/;

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const quoteIfNeeded = (value: string): string => {
  if (value === "") return '""';
  if (/^\s|\s$/.test(value) || /[#"'\\\n\r]/.test(value)) return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return value;
};

export const parseEnv = (contents: string): EnvLine[] =>
  contents.split(/\r?\n/).map((raw) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return { raw };

    const match = raw.match(ASSIGNMENT);
    if (!match) return { raw };

    return { raw, prefix: match[1], name: match[2], value: unquote(match[3]) };
  });

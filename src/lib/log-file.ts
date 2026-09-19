import fs from "node:fs";
import path from "node:path";
import { isLoggingEnabled } from "./logger";

const enabled = (process.env.LOG_TO_FILE ?? "true") === "true";
const directory = path.resolve(/*turbopackIgnore: true*/ process.env.LOG_DIR ?? "logs");
const maxBytes = Math.max(1, Number(process.env.LOG_FILE_MAX_SIZE_MB ?? 10)) * 1024 * 1024;
const retentionDays = Math.max(1, Number(process.env.LOG_FILE_RETENTION_DAYS ?? 14));

const serviceName = process.env.LOG_SERVICE_NAME ?? "finarthax";

const today = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

let disabled = !enabled;

const disableWithNotice = (reason: string, error: unknown) => {
  if (disabled) return;
  disabled = true;
  console.error(`[logger] file logging disabled: ${reason}`, error);
};

class RotatingLogFile {
  private stream: fs.WriteStream | null = null;
  private currentDate = "";
  private currentPath = "";
  private index = 0;
  private written = 0;

  constructor(private readonly prefix: string) {}

  private pathFor(date: string, index: number): string {
    return path.join(/*turbopackIgnore: true*/ directory, index === 0 ? `${this.prefix}-${date}.log` : `${this.prefix}-${date}.${index}.log`);
  }

  private openForDate(date: string) {
    let index = 0;
    let size = 0;

    for (;;) {
      let existing = 0;
      try {
        existing = fs.statSync(this.pathFor(date, index)).size;
      } catch {
        existing = 0;
      }

      if (existing < maxBytes) {
        size = existing;
        break;
      }

      index += 1;
    }

    this.openAt(date, index, size);
  }

  private openAt(date: string, index: number, size: number) {
    this.close();

    const file = this.pathFor(date, index);

    this.stream = fs.createWriteStream(file, { flags: "a" });
    this.stream.on("error", (error) => disableWithNotice(`write failed for ${file}`, error));

    this.currentDate = date;
    this.currentPath = file;
    this.index = index;
    this.written = size;
  }

  write(line: string) {
    const date = today();

    if (!this.stream || date !== this.currentDate) {
      this.openForDate(date);
    } else if (this.written >= maxBytes) {
      this.openAt(date, this.index + 1, 0);
    }

    const payload = `${line}\n`;
    this.written += Buffer.byteLength(payload);
    this.stream?.write(payload);
  }

  close() {
    this.stream?.end();
    this.stream = null;
  }

  get filePath() {
    return this.currentPath;
  }
}

export const purgeExpiredLogs = (): void => {
  if (disabled) return;

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  try {
    for (const name of fs.readdirSync(/*turbopackIgnore: true*/ directory)) {
      if (!name.startsWith(serviceName) || !name.endsWith(".log")) continue;

      const file = path.join(/*turbopackIgnore: true*/ directory, name);
      try {
        if (fs.statSync(/*turbopackIgnore: true*/ file).mtimeMs < cutoff) fs.unlinkSync(file);
      } catch {
        // Another process may have removed it already - nothing to do.
      }
    }
  } catch (error) {
    disableWithNotice("could not read the log directory", error);
  }
};

let appFile: RotatingLogFile | null = null;
let errorFile: RotatingLogFile | null = null;

if (!disabled) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    appFile = new RotatingLogFile(serviceName);
    errorFile = new RotatingLogFile(`${serviceName}-error`);
  } catch (error) {
    disableWithNotice(`could not create ${directory}`, error);
  }
}

export const fileLoggingEnabled = (): boolean => !disabled;

export const logDirectory = (): string => directory;

export const writeToLogFile = (line: string, isProblem: boolean): void => {
  if (disabled) {
    if (!isLoggingEnabled) {
      if (isProblem) console.error(line);
      else console.log(line);
    }
    return;
  }

  try {
    appFile?.write(line);
    if (isProblem) errorFile?.write(line);
  } catch (error) {
    disableWithNotice("unexpected write error", error);
  }
};

export const closeLogFiles = (): void => {
  appFile?.close();
  errorFile?.close();
};

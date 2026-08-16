import fs from "node:fs";
import path from "node:path";
import { consoleLoggingEnabled } from "./logger";

/**
 * Appends log lines to rotating files on disk, so a deployment does not need a
 * log shipper to keep any history. Everything here is best-effort: if the disk
 * is full or the directory is not writable, file logging switches itself off and
 * the app keeps running on console output alone.
 *
 *   LOG_TO_FILE             true | false   (default: true)
 *   LOG_DIR                 directory for the files (default: "logs")
 *   LOG_FILE_MAX_SIZE_MB    rotate once a file passes this size (default: 10)
 *   LOG_FILE_RETENTION_DAYS delete files older than this (default: 14)
 *
 * This is the only destination the app writes to by default, so it is on in every
 * environment. Files are always JSON, one object per line - they are read with
 * `jq` and `grep`, not by eye.
 */

const enabled = (process.env.LOG_TO_FILE ?? "true") === "true";

// `path.resolve` on a relative value already resolves against the working
// directory. Naming `process.cwd()` explicitly makes the build tracer assume the
// entire project is a runtime dependency and warn, so it is left out.
//
// The `turbopackIgnore` comments on this and the other filesystem calls below are
// the sanctioned way to tell the build tracer to stop following a path it cannot
// resolve statically. LOG_DIR is chosen at run time by design, so no amount of
// rewriting would make these paths knowable at build time. Nothing here is traced
// in the first place - the app is served by `next start` from a full checkout and
// the Dockerfile copies explicit paths - so the warnings were noise, not a
// symptom.
const directory = path.resolve(/*turbopackIgnore: true*/ process.env.LOG_DIR ?? "logs");
const maxBytes = Math.max(1, Number(process.env.LOG_FILE_MAX_SIZE_MB ?? 10)) * 1024 * 1024;
const retentionDays = Math.max(1, Number(process.env.LOG_FILE_RETENTION_DAYS ?? 14));

const serviceName = process.env.LOG_SERVICE_NAME ?? "finarthax";

/** `2026-08-05` in local time - matches how someone reading the logs thinks about "yesterday". */
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
  // Deliberately console, not logger - the logger is what just failed.
  console.error(`[logger] file logging disabled: ${reason}`, error);
};

class RotatingLogFile {
  private stream: fs.WriteStream | null = null;
  private currentDate = "";
  private currentPath = "";
  private index = 0;
  /**
   * Bytes handed to the stream, not bytes on disk. Writes are buffered, so
   * `statSync` lags behind and must never be used to decide when to rotate -
   * doing so reopens the same file forever and churns through streams.
   */
  private written = 0;

  constructor(private readonly prefix: string) {}

  private pathFor(date: string, index: number): string {
    return path.join(/*turbopackIgnore: true*/ directory, index === 0 ? `${this.prefix}-${date}.log` : `${this.prefix}-${date}.${index}.log`);
  }

  /** First file for `date` that still has room — used when opening, never mid-run. */
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

/**
 * Drops log files past the retention window, so the disk cannot fill up
 * unattended. Called at startup and once a day from the instrumentation hook
 * rather than from `write`, which stays free of directory scans.
 */
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
    // warn + error also go to their own file, so triage does not mean sifting
    // through every successful request first.
    errorFile = new RotatingLogFile(`${serviceName}-error`);
  } catch (error) {
    disableWithNotice(`could not create ${directory}`, error);
  }
}

export const fileLoggingEnabled = (): boolean => !disabled;

export const logDirectory = (): string => directory;

export const writeToLogFile = (line: string, isProblem: boolean): void => {
  if (disabled) {
    // The files are the only destination unless LOG_TO_CONSOLE is on, so if they
    // become unwritable the logs have to fall back to stdout - going quiet would
    // leave the app with no record of anything at all.
    if (!consoleLoggingEnabled) {
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

/** Flushes both streams on shutdown so the last lines are not lost. */
export const closeLogFiles = (): void => {
  appFile?.close();
  errorFile?.close();
};

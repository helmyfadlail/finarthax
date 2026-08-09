import { logger, setLogSink } from "./lib/logger";
import { closeLogFiles, fileLoggingEnabled, logDirectory, purgeExpiredLogs, writeToLogFile } from "./lib/log-file";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Node-runtime-only startup work. Kept in its own module, dynamically imported,
 * for two reasons: Next bundles `instrumentation.ts` for the edge runtime where
 * `process.on` does not exist, and keeping `node:fs` out of `logger.ts` stops the
 * build tracer from pulling the whole project into every route bundle.
 */
export const registerNodeInstrumentation = () => {
  // Route files only ever import the logger; the file writer is bolted on here.
  // Attached even when the directory turned out to be unwritable, because the
  // writer then falls back to stdout rather than dropping the lines.
  setLogSink(writeToLogFile);

  if (fileLoggingEnabled()) {
    // Retention: once at boot, then daily for a process that stays up for weeks.
    // `unref` so this timer never holds the process open on shutdown.
    purgeExpiredLogs();
    setInterval(purgeExpiredLogs, ONE_DAY_MS).unref();
  }

  logger.info("server.start", {
    env: process.env.NODE_ENV,
    node: process.version,
    pid: process.pid,
    logLevel: logger.level,
    logFile: fileLoggingEnabled() ? logDirectory() : false,
  });

  // Without these, a stray rejection in a background task (`after()`, the cron
  // digest) dies silently and the first sign of trouble in production is missing data.
  process.on("unhandledRejection", (reason) => {
    logger.error("process.unhandled_rejection", { err: reason });
  });

  process.on("uncaughtException", (error) => {
    logger.error("process.uncaught_exception", { err: error });
  });

  // Flush the log files before the process goes away, or the last lines written -
  // usually the interesting ones - never reach the disk.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      logger.info("server.shutdown", { signal });
      closeLogFiles();
    });
  }

  process.once("exit", closeLogFiles);
};

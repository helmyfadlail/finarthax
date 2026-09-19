import { logger, setLogSink } from "./lib/logger";
import { closeLogFiles, fileLoggingEnabled, logDirectory, purgeExpiredLogs, writeToLogFile } from "./lib/log-file";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const registerNodeInstrumentation = () => {
  setLogSink(writeToLogFile);

  if (fileLoggingEnabled()) {
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

  process.on("unhandledRejection", (reason) => {
    logger.error("process.unhandled_rejection", { err: reason });
  });

  process.on("uncaughtException", (error) => {
    logger.error("process.uncaught_exception", { err: error });
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      logger.info("server.shutdown", { signal });
      closeLogFiles();
    });
  }

  process.once("exit", closeLogFiles);
};

import { getRequestContext } from "./request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isProduction = process.env.NODE_ENV === "production";

const resolveLevel = (): LogLevel => {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVEL_PRIORITY) return configured as LogLevel;
  return isProduction ? "info" : "debug";
};

const resolveFormat = (): "pretty" | "json" => {
  const configured = process.env.LOG_FORMAT?.toLowerCase();
  if (configured === "pretty" || configured === "json") return configured;
  console.warn(`[logger] LOG_FORMAT is ${configured === undefined ? "not set" : `invalid ("${process.env.LOG_FORMAT}")`} - expected "pretty" or "json", defaulting to "json".`);
  return "json";
};

const activeLevel = resolveLevel();
const isPretty = resolveFormat() === "pretty";
const serviceName = process.env.LOG_SERVICE_NAME ?? "finarthax";

export const isLoggingEnabled = (process.env.LOG_TO_CONSOLE ?? "false") === "true";

export type LogSink = (line: string, isProblem: boolean) => void;

interface GlobalWithSink {
  __finarthaxLogSink__?: LogSink;
}

const sinkStore = globalThis as unknown as GlobalWithSink;

export const setLogSink = (next: LogSink | null): void => {
  sinkStore.__finarthaxLogSink__ = next ?? undefined;
};

const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEMS = 20;
const MAX_DEPTH = 4;

const REDACTED = "***redacted***";

const SENSITIVE_KEY = /(password|passwd|secret|token|apikey|privatekey|authorization|credential|cookie|sessionid|creditcard|cardnumber|cvv|otp|pin)/i;

const EMAIL_KEY = /^(email|useremail|mail|to|recipient)$/i;

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const maskEmail = (value: string): string => {
  const at = value.indexOf("@");
  if (at < 1) return value;
  const name = value.slice(0, at);
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}***${value.slice(at)}`;
};

export const serializeError = (error: unknown): LogFields => {
  if (error instanceof Error) {
    const serialized: LogFields = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    const code = (error as { code?: unknown }).code;
    if (code !== undefined) serialized.code = code;
    if (error.cause !== undefined) serialized.cause = serializeError(error.cause);
    return serialized;
  }

  return { name: "NonError", message: typeof error === "string" ? error : safeStringify(error) };
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return "[unserializable]";
  }
};

export const sanitize = (value: unknown, depth = 0, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[${value.length} chars]` : value;

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[function]";
  if (typeof value === "symbol") return value.toString();

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);

  if (depth >= MAX_DEPTH) return "[truncated]";

  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`...[${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }

  if (typeof (value as { toNumber?: unknown }).toNumber === "function") return (value as { toNumber(): number }).toNumber();

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.replace(/[_\-\s]/g, "");
      if (SENSITIVE_KEY.test(normalizedKey)) {
        result[key] = REDACTED;
        continue;
      }
      if (EMAIL_KEY.test(normalizedKey) && typeof item === "string") {
        result[key] = maskEmail(item);
        continue;
      }
      result[key] = sanitize(item, depth + 1, seen);
    }
    return result;
  }

  return safeStringify(value);
};

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

const useColor = process.env.NO_COLOR === undefined && process.stdout?.isTTY === true;

const paint = (color: string, text: string): string => (useColor ? `${color}${text}${RESET}` : text);

const formatPretty = (level: LogLevel, message: string, entry: LogFields): string => {
  const { time, level: _level, msg: _msg, service: _service, requestId, err, ...rest } = entry as LogFields & { time: string };
  void _level;
  void _msg;
  void _service;

  const clock = String(time).slice(11, 23);
  const label = level.toUpperCase().padEnd(5);
  const trace = requestId ? paint(DIM, ` [${String(requestId).slice(0, 8)}]`) : "";

  const error = err as LogFields | undefined;
  const errorSummary = error ? { err: `${error.name}: ${error.message}` } : {};

  const details = Object.entries({ ...errorSummary, ...rest })
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : safeStringify(value)}`)
    .join(" ");

  const stack = typeof error?.stack === "string" ? `\n${paint(DIM, error.stack)}` : "";

  return `${paint(DIM, clock)} ${paint(COLORS[level], label)}${trace} ${message}${details ? ` ${paint(DIM, details)}` : ""}${stack}`;
};

const write = (level: LogLevel, message: string, fields: LogFields): void => {
  const context = getRequestContext();

  const entry: LogFields = {
    time: new Date().toISOString(),
    level,
    msg: message,
    service: serviceName,
    ...(context && {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      route: context.route,
      ...(context.userId && { userId: context.userId }),
    }),
    ...(sanitize(fields) as LogFields),
  };

  const json = safeStringify(entry);

  sinkStore.__finarthaxLogSink__?.(json, level === "warn" || level === "error");

  if (!isLoggingEnabled) return;

  const line = isPretty ? formatPretty(level, message, entry) : json;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
  time(message: string, fields?: LogFields): (extra?: LogFields) => void;
  readonly level: LogLevel;
}

const createLogger = (bindings: LogFields = {}): Logger => {
  const log = (level: LogLevel, message: string, fields?: LogFields) => {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[activeLevel]) return;
    try {
      write(level, message, { ...bindings, ...fields });
    } catch {
      // Logging must never break the request it is describing.
    }
  };

  return {
    level: activeLevel,
    debug: (message, fields) => log("debug", message, fields),
    info: (message, fields) => log("info", message, fields),
    warn: (message, fields) => log("warn", message, fields),
    error: (message, fields) => log("error", message, fields),
    child: (extra) => createLogger({ ...bindings, ...extra }),
    time: (message, fields) => {
      const startedAt = performance.now();
      return (extra) => log("debug", message, { ...fields, ...extra, durationMs: Math.round((performance.now() - startedAt) * 100) / 100 });
    },
  };
};

export const logger = createLogger();

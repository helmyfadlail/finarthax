import { prisma } from "./prisma";
import { Prisma } from "prisma-client/client";

const DATABASE_TIMEOUT_MS = Number(process.env.DATABASE_TIMEOUT_MS) || 5_000;
const HEALTH_CACHE_TTL_MS = Number(process.env.HEALTH_CACHE_TTL_MS) || 10_000;

type DatabaseStatus = "up" | "down";

type DatabaseErrorCode = "CONNECTION_REFUSED" | "HOST_NOT_FOUND" | "TIMEOUT" | "AUTH_FAILED" | "DATABASE_NOT_FOUND" | "SSL_ERROR" | "TOO_MANY_CONNECTIONS" | "UNKNOWN";

interface DatabaseCheckResult {
  status: DatabaseStatus;
  latency: number;
  error?: string;
  errorCode?: DatabaseErrorCode;
}

let cachedHealth: { status: DatabaseStatus; checkedAt: number } | null = null;

function findNodeErrorCode(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== "object" || depth > 5) return undefined;

  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    const code = (error as { code: string }).code;
    if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH", "ECONNRESET"].includes(code)) {
      return code;
    }
  }

  if ("cause" in error) {
    return findNodeErrorCode((error as { cause?: unknown }).cause, depth + 1);
  }

  return undefined;
}

function parseDatabaseError(error: unknown): { message: string; code: DatabaseErrorCode } {
  const nodeCode = findNodeErrorCode(error);
  if (nodeCode) {
    switch (nodeCode) {
      case "ECONNREFUSED":
        return {
          code: "CONNECTION_REFUSED",
          message: "Connection refused by the database server. It may be down, not listening on the expected port, or blocked by a firewall.",
        };
      case "ENOTFOUND":
        return {
          code: "HOST_NOT_FOUND",
          message: "Database host could not be resolved. Check the hostname in your connection string and DNS configuration.",
        };
      case "ETIMEDOUT":
      case "EHOSTUNREACH":
        return {
          code: "TIMEOUT",
          message:
            "Connection to the database timed out or the host was unreachable. Note: in Prisma 7, the driver (e.g. `pg`) no longer applies a connection timeout by default — configure one on the adapter if this happens often.",
        };
      case "ECONNRESET":
        return {
          code: "CONNECTION_REFUSED",
          message: "The database server closed the connection unexpectedly. It may have restarted or hit a connection limit.",
        };
    }
  }

  if (error instanceof Error && error.message === "Database check timed out") {
    return {
      code: "TIMEOUT",
      message: `Database did not respond within ${DATABASE_TIMEOUT_MS}ms. The server may be overloaded, unreachable, or network latency is too high.`,
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    const raw = error.message;

    if (raw.includes("ECONNREFUSED") || raw.includes("Connection refused")) {
      return {
        code: "CONNECTION_REFUSED",
        message: "Connection refused by the database server. It may be down, not listening on the expected port, or blocked by a firewall.",
      };
    }
    if (raw.includes("ENOTFOUND") || raw.includes("getaddrinfo")) {
      return {
        code: "HOST_NOT_FOUND",
        message: "Database host could not be resolved. Check the hostname in your connection string (DATABASE_URL) and DNS configuration.",
      };
    }
    if (raw.includes("ETIMEDOUT") || raw.toLowerCase().includes("timed out")) {
      return {
        code: "TIMEOUT",
        message: "Connection to the database timed out. The server may be unreachable due to network issues or a misconfigured host/port.",
      };
    }
    if (raw.includes("password authentication failed") || raw.includes("Access denied") || raw.includes("authentication failed")) {
      return {
        code: "AUTH_FAILED",
        message: "Authentication failed. Check the username/password in your DATABASE_URL.",
      };
    }
    if (raw.toLowerCase().includes("database") && raw.includes("does not exist")) {
      return {
        code: "DATABASE_NOT_FOUND",
        message: "The specified database does not exist on the server. Check the database name in your DATABASE_URL.",
      };
    }
    if (raw.includes("SSL") || raw.includes("certificate")) {
      return {
        code: "SSL_ERROR",
        message: "SSL/TLS connection error. Check your sslmode setting in the connection string, or certificate validity.",
      };
    }
    if (raw.includes("too many connections") || raw.includes("remaining connection slots")) {
      return {
        code: "TOO_MANY_CONNECTIONS",
        message: "The database has reached its maximum connection limit. Consider a connection pooler or raising max_connections.",
      };
    }

    return { code: "UNKNOWN", message: `Database initialization error: ${raw}` };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      code: "UNKNOWN",
      message: `Database query error (${error.code}): ${error.message}`,
    };
  }

  if (error instanceof Error) {
    return { code: "UNKNOWN", message: error.message };
  }

  return { code: "UNKNOWN", message: "Unknown database error" };
}

export async function checkDatabaseConnection(): Promise<DatabaseCheckResult> {
  const start = Date.now();

  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error("Database check timed out")), DATABASE_TIMEOUT_MS))]);

    return { status: "up", latency: Date.now() - start };
  } catch (error) {
    const { message, code } = parseDatabaseError(error);
    return { status: "down", latency: Date.now() - start, error: message, errorCode: code };
  }
}

export async function getDatabaseHealth(): Promise<DatabaseStatus> {
  const now = Date.now();

  if (cachedHealth && now - cachedHealth.checkedAt < HEALTH_CACHE_TTL_MS) {
    return cachedHealth.status;
  }

  const result = await checkDatabaseConnection();
  cachedHealth = { status: result.status, checkedAt: now };

  return cachedHealth.status;
}

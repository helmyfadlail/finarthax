import { prisma } from "./prisma";

const DATABASE_TIMEOUT_MS = Number(process.env.DATABASE_TIMEOUT_MS) || 0;
const HEALTH_CACHE_TTL_MS = Number(process.env.HEALTH_CACHE_TTL_MS) || 0;

type DatabaseStatus = "up" | "down";

let cachedHealth: { status: DatabaseStatus; checkedAt: number } | null = null;

export async function checkDatabaseConnection() {
  const start = Date.now();

  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error("Database check timed out")), DATABASE_TIMEOUT_MS))]);

    return { status: "up" as const, latency: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return { status: "down" as const, latency: Date.now() - start, error: message };
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

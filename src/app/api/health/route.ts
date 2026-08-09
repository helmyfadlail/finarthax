import { NextResponse } from "next/server";
import { checkDatabaseConnection, logger, withApi } from "@/lib";

export const dynamic = "force-dynamic";

export const GET = withApi(
  "health.check",
  async () => {
    const database = await checkDatabaseConnection();
    const isHealthy = database.status === "up";

    // Probes hit this constantly; only the unhealthy result is worth a log line.
    if (!isHealthy) logger.error("health.unhealthy", { database });

    const body = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: { database },
    };

    return NextResponse.json(body, {
      status: isHealthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  },
  { maintenance: false, quiet: true },
);

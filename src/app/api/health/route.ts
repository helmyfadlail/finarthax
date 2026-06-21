import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib";
import { errorResponse } from "@/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = await checkDatabaseConnection();
    const isHealthy = database.status === "up";

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
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "Service unavailable";
    return errorResponse(errorMessage, 503);
  }
}

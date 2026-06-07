import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib";
import { errorResponse } from "@/utils";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export async function withMaintenanceGuard(request: NextRequest, handler: () => Promise<NextResponse>): Promise<NextResponse> {
  if (SAFE_METHODS.includes(request.method as (typeof SAFE_METHODS)[number])) {
    return handler();
  }

  const maintenanceSetting = await prisma.appSetting.findFirst({ where: { key: "maintenance_mode" } });

  if (maintenanceSetting?.value === "true") {
    return errorResponse("App is under maintenance. Please try again later.", 503);
  }

  return handler();
}

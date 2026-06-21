import { NextRequest } from "next/server";
import { prisma, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const settings = await prisma.appSetting.findMany({
        where: { isPublic: true },
        orderBy: [{ category: "asc" }, { key: "asc" }, { sortOrder: "asc" }],
        select: {
          key: true,
          value: true,
          type: true,
          category: true,
          label: true,
          description: true,
        },
      });

      const parsed = settings.map((s) => ({ ...s, value: s.type === "json" ? JSON.parse(s.value) : s.value }));
      return successResponse(parsed);
    } catch (error) {
      console.error("[GET /settings]", error);
      return errorResponse("Failed to fetch app settings", 500);
    }
  });
}

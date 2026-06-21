import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";
import { DEFAULT_SETTINGS } from "@/static";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();

      let settings = await prisma.userSetting.findMany({ where: { userId: user.id }, orderBy: [{ category: "asc" }, { key: "asc" }] });

      if (settings.length === 0) {
        const defaultSettings = DEFAULT_SETTINGS.map((setting) => ({ userId: user.id, ...setting }));

        await prisma.userSetting.createMany({ data: defaultSettings, skipDuplicates: true });

        settings = await prisma.userSetting.findMany({ where: { userId: user.id }, orderBy: [{ category: "asc" }, { key: "asc" }] });
      }

      return successResponse(settings);
    } catch (error) {
      console.error(error);

      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);

      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

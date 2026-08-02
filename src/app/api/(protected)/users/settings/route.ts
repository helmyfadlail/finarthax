import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";
import { USER_SETTINGS } from "@/static";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();

      const existing = await prisma.userSetting.findMany({ where: { userId: user.id }, select: { key: true } });
      const existingKeys = new Set(existing.map((setting) => setting.key));
      const catalogueKeys = new Set(USER_SETTINGS.map((setting) => setting.key));

      const missing = USER_SETTINGS.filter((setting) => !existingKeys.has(setting.key));
      const retired = [...existingKeys].filter((key) => !catalogueKeys.has(key));

      if (missing.length > 0 || retired.length > 0) {
        await prisma.$transaction(async (tx) => {
          if (missing.length > 0) {
            await tx.userSetting.createMany({ data: missing.map((setting) => ({ userId: user.id, ...setting })), skipDuplicates: true });
          }

          if (retired.length > 0) {
            await tx.userSetting.deleteMany({ where: { userId: user.id, key: { in: retired } } });
          }
        });
      }

      const settings = await prisma.userSetting.findMany({ where: { userId: user.id }, orderBy: [{ category: "asc" }, { key: "asc" }] });

      return successResponse(settings);
    } catch (error) {
      console.error(error);

      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);

      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

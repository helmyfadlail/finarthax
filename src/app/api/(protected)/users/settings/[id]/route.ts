import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateSettingValueSchema } from "@/types";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { id } = await params;

      const body = await req.json();

      const validation = updateSettingValueSchema.safeParse(body);
      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const existingSetting = await prisma.userSetting.findUnique({ where: { userId_key: { userId: user.id, key: id } } });

      if (!existingSetting) return errorResponse("Setting not found. Please create a new setting first.", 404);

      const setting = await prisma.userSetting.update({
        where: { userId_key: { userId: user.id, key: id } },
        data: { value: validation.data.value },
      });

      return successResponse(setting, "Setting value updated successfully");
    } catch (error) {
      console.error(error);

      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);

      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

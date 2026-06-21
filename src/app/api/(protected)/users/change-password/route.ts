import { NextRequest } from "next/server";
import { calculatePasswordExpiresAt, getMaxPasswordAgeDays, prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { changePasswordSchema } from "@/types";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const body = await req.json();
      const validation = changePasswordSchema.safeParse(body);

      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const { currentPassword, newPassword } = validation.data;

      const userData = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } });

      if (!userData?.password) return errorResponse("Cannot change password for OAuth accounts", 400);

      const isValid = await bcrypt.compare(currentPassword, userData.password);

      if (!isValid) return errorResponse("Current password is incorrect", 401);

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const maxPasswordAgeDays = await getMaxPasswordAgeDays();
      const now = new Date();
      const passwordExpiresAt = calculatePasswordExpiresAt(now, maxPasswordAgeDays);

      await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword, passwordChangedAt: now, passwordExpiresAt } });

      return successResponse(null, "Password changed successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

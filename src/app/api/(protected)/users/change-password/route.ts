import { NextRequest } from "next/server";
import { calculatePasswordExpiresAt, getMaxPasswordAgeDays, logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { changePasswordSchema } from "@/types";
import bcrypt from "bcryptjs";

export const POST = withApi("users.change_password", async (req: NextRequest) => {
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

  if (!isValid) {
    // Security-relevant: repeated hits from one ip are what a brute-force attempt looks like.
    logger.warn("users.change_password_rejected", { reason: "current_password_mismatch" });
    return errorResponse("Current password is incorrect", 401);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const maxPasswordAgeDays = await getMaxPasswordAgeDays();
  const now = new Date();
  const passwordExpiresAt = calculatePasswordExpiresAt(now, maxPasswordAgeDays);

  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword, passwordChangedAt: now, passwordExpiresAt } });

  logger.info("users.password_changed", { expiresAt: passwordExpiresAt?.toISOString() ?? null });

  return successResponse(null, "Password changed successfully");
});

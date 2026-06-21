import { NextRequest } from "next/server";
import { calculatePasswordExpiresAt, getMaxPasswordAgeDays, prisma, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { RESET_PASSWORD_SUCCESS_DEFAULTS } from "@/static";
import { resetPasswordSchema } from "@/types";

async function getResetPasswordSuccessSettings() {
  const keys = Object.keys(RESET_PASSWORD_SUCCESS_DEFAULTS);

  const settings = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });

  const settingsMap = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value ?? "";
    return acc;
  }, {});

  return {
    title: settingsMap.reset_password_success_title || RESET_PASSWORD_SUCCESS_DEFAULTS.reset_password_success_title,
    description: settingsMap.reset_password_success_description || RESET_PASSWORD_SUCCESS_DEFAULTS.reset_password_success_description,
    redirect: settingsMap.reset_password_success_redirect_url || RESET_PASSWORD_SUCCESS_DEFAULTS.reset_password_success_redirect_url,
    redirectLabel: settingsMap.reset_password_success_redirect_label || RESET_PASSWORD_SUCCESS_DEFAULTS.reset_password_success_redirect_label,
    autoRedirect: settingsMap.reset_password_success_auto_redirect || RESET_PASSWORD_SUCCESS_DEFAULTS.reset_password_success_auto_redirect,
  };
}

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const body = await req.json();
      const validation = resetPasswordSchema.safeParse(body);

      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const { token, password } = validation.data;

      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      const resetToken = await prisma.verificationToken.findFirst({ where: { token: hashedToken, expires: { gt: new Date() } } });

      if (!resetToken) return errorResponse("Invalid or expired token", 400);

      const user = await prisma.user.findUnique({ where: { email: resetToken.identifier } });

      if (!user) return errorResponse("User not found", 404);

      const hashedPassword = await bcrypt.hash(password, 10);

      const maxPasswordAgeDays = await getMaxPasswordAgeDays();
      const now = new Date();
      const passwordExpiresAt = calculatePasswordExpiresAt(now, maxPasswordAgeDays);

      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword, passwordChangedAt: now, passwordExpiresAt } }),
        prisma.verificationToken.delete({ where: { identifier_token: { identifier: resetToken.identifier, token: hashedToken } } }),
      ]);

      const successSettings = await getResetPasswordSuccessSettings();
      const successParams = new URLSearchParams(successSettings);
      const redirectUrl = `/reset-password/success?${successParams.toString()}`;

      return successResponse({ redirectUrl }, "Password reset successful");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

import { NextRequest } from "next/server";

import { prisma, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse, validationErrorResponse } from "@/utils";

import z from "zod";

import { resetPasswordSchema } from "@/types";

import crypto from "crypto";

import bcrypt from "bcryptjs";

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

      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
        prisma.verificationToken.delete({ where: { identifier_token: { identifier: resetToken.identifier, token: hashedToken } } }),
      ]);

      return successResponse(null, "Password reset successful");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

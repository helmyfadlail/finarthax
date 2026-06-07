import { NextRequest } from "next/server";

import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse, validationErrorResponse } from "@/utils";

import { z } from "zod";

import { updateProfileSchema } from "@/types";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();

      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          avatarFileId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!userData) return errorResponse("User not found", 404);

      return successResponse(userData);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

export async function PUT(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const body = await req.json();

      const validation = updateProfileSchema.safeParse(body);

      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const { name, avatar, avatarFileId } = validation.data;

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(name !== undefined && { name }),
          ...(avatar !== undefined && { avatar }),
          ...(avatarFileId !== undefined && { avatarFileId }),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          avatarFileId: true,
          updatedAt: true,
        },
      });

      return successResponse(updatedUser, "Profile updated successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import { z } from "zod";
import { updateProfileSchema } from "@/types";

export const GET = withApi("users.profile.get", async () => {
  const user = await requireAuth();

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      avatarFileId: true,
      passwordExpiresAt: true,
      passwordChangedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!userData) {
    // A live session pointing at a deleted row - rare, and always worth investigating.
    logger.error("users.profile_missing", { sessionUserId: user.id });
    return errorResponse("User not found", 404);
  }

  return successResponse(userData);
});

export const PUT = withApi("users.profile.update", async (req: NextRequest) => {
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

  logger.info("users.profile_updated", { fields: Object.keys(validation.data) });

  return successResponse(updatedUser, "Profile updated successfully");
});

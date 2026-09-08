import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export const PATCH = withApi<{ id: string }>("notifications.mark-read", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const existing = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Notification not found", 404);

  const notification = await prisma.notification.update({ where: { id }, data: { isRead: true } });

  return successResponse(notification, "Notification marked as read");
});

export const DELETE = withApi<{ id: string }>("notifications.delete", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const existing = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Notification not found", 404);

  await prisma.notification.delete({ where: { id } });

  logger.info("notifications.deleted", { notificationId: id });

  return successResponse(null, "Notification deleted");
});

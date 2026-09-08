import { prisma, requireAuth, withApi } from "@/lib";
import { successResponse } from "@/utils";

export const PATCH = withApi("notifications.mark-all-read", async () => {
  const user = await requireAuth();

  await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });

  return successResponse(null, "All notifications marked as read");
});

import { logger, prisma, requireAuth, withApi } from "@/lib";
import { successResponse } from "@/utils";

export const DELETE = withApi("users.delete", async () => {
  const user = await requireAuth();

  // Irreversible and cascades to every table - always worth an audit line.
  logger.warn("users.delete_requested", { targetUserId: user.id });

  await prisma.user.delete({ where: { id: user.id } });

  logger.warn("users.deleted", { targetUserId: user.id });

  return successResponse(null, "Account deleted successfully");
});

import { NextRequest } from "next/server";
import { findSeriesSiblings, logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

const setDismissedAt = async (userId: string, id: string, dismissedAt: Date | null) => {
  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) return null;

  const siblings = await findSeriesSiblings(userId, transaction);

  await prisma.transaction.updateMany({
    where: { id: { in: siblings.map((sibling) => sibling.id) } },
    data: { recurrenceDismissedAt: dismissedAt },
  });

  return siblings.length;
};

export const POST = withApi<{ id: string }>("recurring.dismiss", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const affected = await setDismissedAt(user.id, id, new Date());
  if (affected === null) return errorResponse("Transaction not found", 404);

  logger.info("recurring.dismissed", { transactionId: id, affected });

  return successResponse({ affected }, "Suggestion dismissed");
});

export const DELETE = withApi<{ id: string }>("recurring.restore", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const affected = await setDismissedAt(user.id, id, null);
  if (affected === null) return errorResponse("Transaction not found", 404);

  logger.info("recurring.restored", { transactionId: id, affected });

  return successResponse({ affected }, "Suggestion restored");
});

import { NextRequest } from "next/server";
import { advanceToFuture, diffInDays, logger, prisma, requireAuth, TRANSACTION_INCLUDE, withApi } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export const POST = withApi<{ id: string }>("recurring.skip", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const transaction = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!transaction) return errorResponse("Transaction not found", 404);

  const interval = transaction.recurrenceInterval;
  if (!interval) return errorResponse("This transaction is not part of a recurring series", 422);

  const nextOccurrence = advanceToFuture(transaction.nextOccurrence ?? transaction.date, interval);
  const isFinished = transaction.recurrenceEndDate !== null && diffInDays(transaction.recurrenceEndDate, nextOccurrence) > 0;

  const updated = await prisma.transaction.update({
    where: { id },
    data: { nextOccurrence: isFinished ? null : nextOccurrence },
    include: TRANSACTION_INCLUDE,
  });

  logger.info("recurring.skipped", {
    transactionId: id,
    interval,
    previousOccurrence: transaction.nextOccurrence?.toISOString() ?? null,
    nextOccurrence: isFinished ? null : nextOccurrence.toISOString(),
    isFinished,
  });

  return successResponse(updated, isFinished ? "Occurrence skipped — the series has reached its end date" : "Occurrence skipped");
});

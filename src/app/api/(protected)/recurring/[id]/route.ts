import { NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { advanceToFuture, diffInDays, findSeriesSiblings, logger, prisma, requireAuth, TRANSACTION_INCLUDE, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { trackRecurringSchema } from "@/types";

export const PATCH = withApi<{ id: string }>("recurring.track", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = trackRecurringSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { isRecurring, interval, endDate } = validation.data;

  const transaction = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!transaction) return errorResponse("Transaction not found", 404);

  if (!isRecurring) {
    const clearedFields = {
      isRecurring: false,
      recurrenceInterval: null,
      recurrenceKey: null,
      nextOccurrence: null,
      recurrenceEndDate: null,
    };

    if (transaction.recurrenceKey) {
      await prisma.transaction.updateMany({ where: { userId: user.id, recurrenceKey: transaction.recurrenceKey }, data: clearedFields });
    } else {
      await prisma.transaction.update({ where: { id }, data: clearedFields });
    }

    logger.info("recurring.untracked", { transactionId: id, recurrenceKey: transaction.recurrenceKey });

    const updated = await prisma.transaction.findUnique({ where: { id }, include: TRANSACTION_INCLUDE });
    return successResponse(updated, "Recurring tracking stopped");
  }

  if (!interval) return errorResponse("Interval is required when tracking a transaction as recurring", 422);

  const recurrenceEndDate = endDate ? new Date(endDate) : (transaction.recurrenceEndDate ?? null);

  const siblings = transaction.recurrenceKey
    ? await prisma.transaction.findMany({
        where: { userId: user.id, recurrenceKey: transaction.recurrenceKey },
        select: { id: true, date: true, description: true },
        orderBy: { date: "asc" },
      })
    : await findSeriesSiblings(user.id, transaction);

  const anchor = siblings[siblings.length - 1];

  const nextOccurrence = advanceToFuture(anchor.date, interval);
  const isFinished = recurrenceEndDate !== null && diffInDays(recurrenceEndDate, nextOccurrence) > 0;
  const recurrenceKey = transaction.recurrenceKey ?? createId();

  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: { id: { in: siblings.map((sibling) => sibling.id) } },
      data: {
        isRecurring: true,
        recurrenceInterval: interval,
        recurrenceKey,
        recurrenceEndDate,
        recurrenceDismissedAt: null,
        nextOccurrence: null,
      },
    });

    await tx.transaction.update({ where: { id: anchor.id }, data: { nextOccurrence: isFinished ? null : nextOccurrence } });
  });

  // This rewrites a whole series at once, so record how many rows it touched.
  logger.info("recurring.tracked", {
    transactionId: id,
    anchorId: anchor.id,
    recurrenceKey,
    interval,
    seriesSize: siblings.length,
    nextOccurrence: isFinished ? null : nextOccurrence.toISOString(),
    isFinished,
  });

  const updated = await prisma.transaction.findUnique({ where: { id: anchor.id }, include: TRANSACTION_INCLUDE });
  return successResponse(updated, isFinished ? "Series tracked, but its end date has already passed" : "Recurring series tracked");
});

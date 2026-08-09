import { NextRequest, after } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import {
  addRecurrence,
  applyBalanceChange,
  applyBudgetChange,
  diffInDays,
  findSeriesSiblings,
  logger,
  notifyBudgetThresholdCrossed,
  notifyTransactionRecorded,
  prisma,
  requireAuth,
  TRANSACTION_INCLUDE,
  validateAccount,
  validateCategory,
  validateCreditCardRules,
  withApi,
} from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { confirmRecurringSchema } from "@/types";

export const POST = withApi<{ id: string }>("recurring.confirm", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const validation = confirmRecurringSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { amount, date, description, keepTracking = true } = validation.data;

  const source = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!source) return errorResponse("Transaction not found", 404);

  const interval = source.recurrenceInterval ?? validation.data.interval;
  if (!interval) return errorResponse("This transaction has no recurrence interval. Track it as recurring first or send an interval.", 422);

  const { error: accountError } = await validateAccount(user.id, source.accountId, source.toAccountId ?? undefined);
  if (accountError) return errorResponse(accountError, 404);

  const creditCardError = await validateCreditCardRules(source.accountId, source.type, source.toAccountId);
  if (creditCardError) return errorResponse(creditCardError, 422);

  const { error: categoryError } = await validateCategory(user.id, source.categoryId ?? undefined);
  if (categoryError) return errorResponse(categoryError, 404);

  const occurrenceDate = date ? new Date(date) : (source.nextOccurrence ?? addRecurrence(source.date, interval));
  const occurrenceAmount = amount ?? Number(source.amount);
  const recurrenceEndDate = source.recurrenceEndDate;

  if (recurrenceEndDate && diffInDays(recurrenceEndDate, occurrenceDate) > 0) {
    return errorResponse("This series already ended. Update its end date before logging another occurrence.", 422);
  }

  // A suggestion confirmed straight from detection has no series yet — create one now.
  let recurrenceKey = source.recurrenceKey;
  if (!recurrenceKey) {
    recurrenceKey = createId();
    const siblings = await findSeriesSiblings(user.id, source);
    await prisma.transaction.updateMany({
      where: { id: { in: siblings.map((sibling) => sibling.id) } },
      data: { isRecurring: true, recurrenceInterval: interval, recurrenceKey, recurrenceDismissedAt: null },
    });

    logger.info("recurring.series_created", { sourceId: id, recurrenceKey, interval, seriesSize: siblings.length });
  }

  const followingOccurrence = addRecurrence(occurrenceDate, interval);
  const isFinished = recurrenceEndDate !== null && diffInDays(recurrenceEndDate, followingOccurrence) > 0;
  const nextOccurrence = keepTracking && !isFinished ? followingOccurrence : null;

  const created = await prisma.$transaction(async (tx) => {
    const occurrence = await tx.transaction.create({
      data: {
        userId: user.id,
        accountId: source.accountId,
        toAccountId: source.toAccountId,
        categoryId: source.categoryId,
        amount: occurrenceAmount,
        type: source.type,
        description: description ?? source.description,
        date: occurrenceDate,
        isRecurring: keepTracking,
        recurrenceInterval: interval,
        recurrenceKey,
        recurrenceEndDate,
        nextOccurrence,
      },
      include: TRANSACTION_INCLUDE,
    });

    await applyBalanceChange(tx, { type: source.type, accountId: source.accountId, toAccountId: source.toAccountId, amount: occurrenceAmount }, "apply");

    await applyBudgetChange(tx, user.id, { type: source.type, categoryId: source.categoryId, amount: occurrenceAmount, date: occurrenceDate }, "apply");

    // Only one row per series may hold the schedule.
    await tx.transaction.updateMany({
      where: { userId: user.id, recurrenceKey, id: { not: occurrence.id } },
      data: { nextOccurrence: null },
    });

    return occurrence;
  });

  logger.info("recurring.confirmed", {
    sourceId: id,
    transactionId: created.id,
    recurrenceKey,
    interval,
    amount: occurrenceAmount,
    occurrenceDate: occurrenceDate.toISOString(),
    nextOccurrence: nextOccurrence?.toISOString() ?? null,
    isFinished,
  });

  // A confirmed occurrence is a recorded transaction, so it notifies like any other.
  after(async () => {
    try {
      await notifyTransactionRecorded(user.id, {
        type: created.type,
        amount: Number(created.amount),
        description: created.description,
        date: created.date,
        accountName: created.account?.name,
        categoryName: created.category?.name,
      });

      if (created.type === "EXPENSE" && created.categoryId) {
        await notifyBudgetThresholdCrossed(user.id, { categoryId: created.categoryId, date: created.date, appliedAmount: Number(created.amount) });
      }
    } catch (error) {
      logger.error("recurring.notify_failed", { transactionId: created.id, err: error });
    }
  });

  return successResponse(created, isFinished ? "Occurrence logged — the series has now reached its end date" : "Recurring transaction logged successfully");
});

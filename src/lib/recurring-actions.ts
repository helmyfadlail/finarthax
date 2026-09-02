import { after } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "prisma-client/client";
import { prisma } from "./prisma";
import { addRecurrence, advanceToFuture, diffInDays, findSeriesSiblings, monthlyEquivalent, resolveStatus } from "./recurring";
import { applyBalanceChange, applyBudgetChange, TRANSACTION_INCLUDE, validateAccount, validateCategory, validateCreditCardRules } from "./transaction";
import { notifyBudgetThresholdCrossed, notifyTransactionRecorded } from "./notifications";
import { logger } from "./logger";
import type { RecurrenceInterval, ScheduledRecurrence, TransactionType } from "@/types";

export type TransactionWithRelations = Prisma.TransactionGetPayload<{ include: typeof TRANSACTION_INCLUDE }>;

export interface RecurringActionResult {
  error?: string;
  status?: number;
  transaction?: TransactionWithRelations;
  message?: string;
}

export interface ConfirmOccurrenceInput {
  amount?: number;
  date?: string;
  description?: string;
  interval?: RecurrenceInterval;
  keepTracking?: boolean;
}

export interface TrackSeriesInput {
  isRecurring: boolean;
  interval?: RecurrenceInterval | null;
  endDate?: string | null;
}

export const SERIES_INCLUDE = {
  account: { select: { id: true, name: true, icon: true, type: true } },
  toAccount: { select: { id: true, name: true, icon: true, type: true } },
  category: { select: { id: true, name: true, icon: true, color: true } },
} as const;

export const listScheduledRecurrences = async (userId: string, now: Date = new Date()): Promise<ScheduledRecurrence[]> => {
  const anchors = await prisma.transaction.findMany({
    where: { userId, nextOccurrence: { not: null }, recurrenceInterval: { not: null } },
    include: SERIES_INCLUDE,
    orderBy: { nextOccurrence: "asc" },
  });

  const seriesKeys = anchors.map((anchor) => anchor.recurrenceKey).filter((key): key is string => !!key);

  const occurrenceCounts = seriesKeys.length
    ? await prisma.transaction.groupBy({
        by: ["recurrenceKey"],
        where: { userId, recurrenceKey: { in: seriesKeys } },
        _count: { _all: true },
      })
    : [];

  const countByKey = new Map(occurrenceCounts.map((row) => [row.recurrenceKey, row._count._all]));

  return anchors.map((anchor) => {
    const interval = anchor.recurrenceInterval as RecurrenceInterval;
    const nextOccurrence = anchor.nextOccurrence as Date;
    const amount = Number(anchor.amount);

    return {
      transactionId: anchor.id,
      recurrenceKey: anchor.recurrenceKey ?? anchor.id,
      type: anchor.type as TransactionType,
      description: anchor.description,
      amount,
      interval,
      status: resolveStatus(nextOccurrence, now),
      nextOccurrence: nextOccurrence.toISOString(),
      lastDate: anchor.date.toISOString(),
      daysUntil: diffInDays(now, nextOccurrence),
      occurrences: countByKey.get(anchor.recurrenceKey) ?? 1,
      monthlyEstimate: Math.round(monthlyEquivalent(amount, interval) * 100) / 100,
      recurrenceEndDate: anchor.recurrenceEndDate?.toISOString() ?? null,
      account: anchor.account,
      toAccount: anchor.toAccount,
      category: anchor.category,
    };
  });
};

const notifyRecorded = (userId: string, created: TransactionWithRelations): void => {
  after(async () => {
    try {
      await notifyTransactionRecorded(userId, {
        type: created.type,
        amount: Number(created.amount),
        description: created.description,
        date: created.date,
        accountName: created.account?.name,
        categoryName: created.category?.name,
      });

      if (created.type === "EXPENSE" && created.categoryId) {
        await notifyBudgetThresholdCrossed(userId, { categoryId: created.categoryId, date: created.date, appliedAmount: Number(created.amount) });
      }
    } catch (error) {
      logger.error("recurring.notify_failed", { transactionId: created.id, err: error });
    }
  });
};

export const confirmOccurrence = async (userId: string, transactionId: string, input: ConfirmOccurrenceInput = {}): Promise<RecurringActionResult> => {
  const { amount, date, description, keepTracking = true } = input;

  const source = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!source) return { error: "Transaction not found", status: 404 };

  const interval = (source.recurrenceInterval ?? input.interval) as RecurrenceInterval | null;
  if (!interval) return { error: "This transaction has no recurrence interval. Track it as recurring first or send an interval.", status: 422 };

  const { error: accountError } = await validateAccount(userId, source.accountId, source.toAccountId ?? undefined);
  if (accountError) return { error: accountError, status: 404 };

  const creditCardError = await validateCreditCardRules(source.accountId, source.type, source.toAccountId);
  if (creditCardError) return { error: creditCardError, status: 422 };

  const { error: categoryError } = await validateCategory(userId, source.categoryId ?? undefined);
  if (categoryError) return { error: categoryError, status: 404 };

  const occurrenceDate = date ? new Date(date) : (source.nextOccurrence ?? addRecurrence(source.date, interval));
  const occurrenceAmount = amount ?? Number(source.amount);
  const recurrenceEndDate = source.recurrenceEndDate;

  if (recurrenceEndDate && diffInDays(recurrenceEndDate, occurrenceDate) > 0) {
    return { error: "This series already ended. Update its end date before logging another occurrence.", status: 422 };
  }

  let recurrenceKey = source.recurrenceKey;
  if (!recurrenceKey) {
    recurrenceKey = createId();
    const siblings = await findSeriesSiblings(userId, source);
    await prisma.transaction.updateMany({
      where: { id: { in: siblings.map((sibling) => sibling.id) } },
      data: { isRecurring: true, recurrenceInterval: interval, recurrenceKey, recurrenceDismissedAt: null },
    });

    logger.info("recurring.series_created", { sourceId: transactionId, recurrenceKey, interval, seriesSize: siblings.length });
  }

  const followingOccurrence = addRecurrence(occurrenceDate, interval);
  const isFinished = recurrenceEndDate !== null && diffInDays(recurrenceEndDate, followingOccurrence) > 0;
  const nextOccurrence = keepTracking && !isFinished ? followingOccurrence : null;

  const created = await prisma.$transaction(async (tx) => {
    const occurrence = await tx.transaction.create({
      data: {
        userId,
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

    await applyBudgetChange(tx, userId, { type: source.type, categoryId: source.categoryId, amount: occurrenceAmount, date: occurrenceDate }, "apply");

    await tx.transaction.updateMany({
      where: { userId, recurrenceKey, id: { not: occurrence.id } },
      data: { nextOccurrence: null },
    });

    return occurrence;
  });

  logger.info("recurring.confirmed", {
    sourceId: transactionId,
    transactionId: created.id,
    recurrenceKey,
    interval,
    amount: occurrenceAmount,
    occurrenceDate: occurrenceDate.toISOString(),
    nextOccurrence: nextOccurrence?.toISOString() ?? null,
    isFinished,
  });

  notifyRecorded(userId, created);

  return {
    transaction: created,
    message: isFinished ? "Occurrence logged — the series has now reached its end date" : "Recurring transaction logged successfully",
  };
};

export const trackSeries = async (userId: string, transactionId: string, input: TrackSeriesInput): Promise<RecurringActionResult> => {
  const { isRecurring, interval, endDate } = input;

  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!transaction) return { error: "Transaction not found", status: 404 };

  if (!isRecurring) {
    const clearedFields = {
      isRecurring: false,
      recurrenceInterval: null,
      recurrenceKey: null,
      nextOccurrence: null,
      recurrenceEndDate: null,
    };

    if (transaction.recurrenceKey) {
      await prisma.transaction.updateMany({ where: { userId, recurrenceKey: transaction.recurrenceKey }, data: clearedFields });
    } else {
      await prisma.transaction.update({ where: { id: transactionId }, data: clearedFields });
    }

    logger.info("recurring.untracked", { transactionId, recurrenceKey: transaction.recurrenceKey });

    const updated = await prisma.transaction.findUnique({ where: { id: transactionId }, include: TRANSACTION_INCLUDE });
    return { transaction: updated ?? undefined, message: "Recurring tracking stopped" };
  }

  if (!interval) return { error: "Interval is required when tracking a transaction as recurring", status: 422 };

  const recurrenceEndDate = endDate ? new Date(endDate) : (transaction.recurrenceEndDate ?? null);

  const siblings = transaction.recurrenceKey
    ? await prisma.transaction.findMany({
        where: { userId, recurrenceKey: transaction.recurrenceKey },
        select: { id: true, date: true, description: true },
        orderBy: { date: "asc" },
      })
    : await findSeriesSiblings(userId, transaction);

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

  logger.info("recurring.tracked", {
    transactionId,
    anchorId: anchor.id,
    recurrenceKey,
    interval,
    seriesSize: siblings.length,
    nextOccurrence: isFinished ? null : nextOccurrence.toISOString(),
    isFinished,
  });

  const updated = await prisma.transaction.findUnique({ where: { id: anchor.id }, include: TRANSACTION_INCLUDE });
  return { transaction: updated ?? undefined, message: isFinished ? "Series tracked, but its end date has already passed" : "Recurring series tracked" };
};

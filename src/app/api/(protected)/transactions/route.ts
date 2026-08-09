import { NextRequest, after } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import {
  addRecurrence,
  applyBalanceChange,
  applyBudgetChange,
  diffInDays,
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
import { Prisma } from "prisma-client/client";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { transactionFilterSchema, transactionSchema } from "@/types";

export const GET = withApi("transactions.list", async (req: NextRequest) => {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);

  const filterData = {
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    type: searchParams.get("type") || undefined,
    accountId: searchParams.get("accountId") || undefined,
    search: searchParams.get("search") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
  };

  const validation = transactionFilterSchema.safeParse(filterData);
  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { startDate, endDate, categoryId, type, accountId, search, page, limit } = validation.data;

  const where: Prisma.TransactionWhereInput = {
    userId: user.id,
    ...(startDate || endDate ? { date: { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) } } : {}),
    ...(categoryId && { categoryId }),
    ...(type && { type }),
    ...(accountId && { accountId }),
    ...(search && {
      description: {
        contains: search,
        mode: "insensitive",
      },
    }),
  };

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  logger.debug("transactions.listed", { returned: data.length, total, page, limit });

  return successResponse({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const POST = withApi("transactions.create", async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await req.json();
  const validation = transactionSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const data = validation.data;

  const { error: accountError } = await validateAccount(user.id, data.accountId, "toAccountId" in data ? data.toAccountId : undefined);
  if (accountError) return errorResponse(accountError, 404);

  const creditCardError = await validateCreditCardRules(data.accountId, data.type, "toAccountId" in data ? data.toAccountId : null);
  if (creditCardError) return errorResponse(creditCardError, 422);

  const { error: categoryError } = await validateCategory(user.id, "categoryId" in data ? data.categoryId : undefined);
  if (categoryError) return errorResponse(categoryError, 404);

  const transactionDate = new Date(data.date);
  const isRecurring = data.isRecurring === true && !!data.recurrenceInterval;
  const recurrenceInterval = isRecurring ? data.recurrenceInterval : null;
  const recurrenceEndDate = isRecurring && data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null;
  const nextOccurrence = recurrenceInterval ? addRecurrence(transactionDate, recurrenceInterval) : null;
  const isFinished = recurrenceEndDate !== null && nextOccurrence !== null && diffInDays(recurrenceEndDate, nextOccurrence) > 0;

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId: user.id,
        accountId: data.accountId,
        toAccountId: "toAccountId" in data ? (data.toAccountId ?? null) : null,
        categoryId: "categoryId" in data ? (data.categoryId ?? null) : null,
        amount: data.amount,
        type: data.type,
        description: data.description,
        date: transactionDate,
        attachment: data.attachment,
        isRecurring,
        recurrenceInterval,
        recurrenceKey: isRecurring ? createId() : null,
        recurrenceEndDate,
        nextOccurrence: isFinished ? null : nextOccurrence,
      },
      include: TRANSACTION_INCLUDE,
    });

    await applyBalanceChange(
      tx,
      {
        type: data.type,
        accountId: data.accountId,
        toAccountId: "toAccountId" in data ? data.toAccountId : null,
        amount: data.amount,
      },
      "apply",
    );

    await applyBudgetChange(
      tx,
      user.id,
      {
        type: data.type,
        categoryId: "categoryId" in data ? data.categoryId : null,
        amount: data.amount,
        date: data.date,
      },
      "apply",
    );

    return created;
  });

  logger.info("transactions.created", {
    transactionId: transaction.id,
    type: transaction.type,
    amount: Number(transaction.amount),
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    isRecurring,
  });

  after(async () => {
    // Background work runs after the response is flushed, so its failures would
    // otherwise never reach the client - they have to be logged here.
    try {
      await notifyTransactionRecorded(user.id, {
        type: transaction.type,
        amount: Number(transaction.amount),
        description: transaction.description,
        date: transaction.date,
        accountName: transaction.account?.name,
        categoryName: transaction.category?.name,
      });

      if (transaction.type === "EXPENSE" && transaction.categoryId) {
        await notifyBudgetThresholdCrossed(user.id, { categoryId: transaction.categoryId, date: transaction.date, appliedAmount: Number(transaction.amount) });
      }
    } catch (error) {
      logger.error("transactions.notify_failed", { transactionId: transaction.id, err: error });
    }
  });

  return successResponse(transaction, "Transaction created successfully");
});

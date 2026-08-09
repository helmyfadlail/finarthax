import { NextRequest, after } from "next/server";
import {
  getTuning,
  applyBalanceChange,
  applyBudgetChange,
  clientKey,
  getUserPreferences,
  logger,
  notifyBudgetThresholdCrossed,
  notifyTransactionRecorded,
  prisma,
  rateLimit,
  readBooleanPreference,
  TRANSACTION_INCLUDE,
  validateAccount,
  validateCategory,
  withApi,
} from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { quickTransactionSchema } from "@/types";

export const GET = withApi("quick_transactions.lookup", async (req: NextRequest) => {
  const tuning = await getTuning();
  const { allowed, retryAfter } = rateLimit(clientKey(req, "quick-lookup"), tuning.quickLookupRateLimit, tuning.quickRateLimitWindowSeconds * 1000);
  if (!allowed) {
    // Unauthenticated endpoint: a client hitting the limit is the earliest signal
    // of someone enumerating email addresses.
    logger.warn("quick_transactions.rate_limited", { scope: "quick-lookup", retryAfter });
    return errorResponse(`Too many lookups. Try again in ${retryAfter}s.`, 429);
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) return errorResponse("Email is required", 422);

  const userData = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      categories: {
        select: {
          id: true,
          name: true,
          icon: true,
          type: true,
          isDefault: true,
        },
      },
      accounts: {
        select: {
          id: true,
          name: true,
          icon: true,
          type: true,
          isDefault: true,
          balance: true,
          creditLimit: true,
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!userData) {
    logger.warn("quick_transactions.lookup_miss", { email });
    return errorResponse("Email not found. Please enter correct email!", 404);
  }

  const preferences = await getUserPreferences(userData.id);
  const showsBalances = readBooleanPreference(preferences, "publicQuickBalances");

  logger.info("quick_transactions.lookup", { targetUserId: userData.id, showsBalances });

  return successResponse({
    email: userData.email,
    name: userData.name,
    categories: userData.categories,
    showsBalances,
    accounts: userData.accounts.map(({ balance, creditLimit, ...account }) =>
      showsBalances ? { ...account, balance: Number(balance), creditLimit: creditLimit === null ? null : Number(creditLimit) } : account,
    ),
  });
});

export const POST = withApi("quick_transactions.create", async (req: NextRequest) => {
  const tuning = await getTuning();
  const { allowed, retryAfter } = rateLimit(clientKey(req, "quick-create"), tuning.quickCreateRateLimit, tuning.quickRateLimitWindowSeconds * 1000);
  if (!allowed) {
    logger.warn("quick_transactions.rate_limited", { scope: "quick-create", retryAfter });
    return errorResponse(`Too many transactions. Try again in ${retryAfter}s.`, 429);
  }

  const body = await req.json();
  const validation = quickTransactionSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { email, ...data } = validation.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return errorResponse("User not found. Please create an account first", 404);

  const { error: accountError } = await validateAccount(user.id, data.accountId, "toAccountId" in data ? data.toAccountId : undefined);
  if (accountError) return errorResponse(accountError, 404);

  const { error: categoryError } = await validateCategory(user.id, "categoryId" in data ? data.categoryId : undefined);
  if (categoryError) return errorResponse(categoryError, 404);

  const quickTransaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId: user.id,
        accountId: data.accountId,
        toAccountId: "toAccountId" in data ? (data.toAccountId ?? null) : null,
        categoryId: "categoryId" in data ? (data.categoryId ?? null) : null,
        amount: data.amount,
        type: data.type,
        description: data.description,
        date: new Date(data.date),
        attachment: data.attachment,
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

  // No session here, so the user id has to be logged explicitly - it is the only
  // way to attribute a public write to an account.
  logger.info("quick_transactions.created", {
    targetUserId: user.id,
    transactionId: quickTransaction.id,
    type: quickTransaction.type,
    amount: Number(quickTransaction.amount),
    accountId: quickTransaction.accountId,
  });

  after(async () => {
    try {
      await notifyTransactionRecorded(user.id, {
        type: quickTransaction.type,
        amount: Number(quickTransaction.amount),
        description: quickTransaction.description,
        date: quickTransaction.date,
        accountName: quickTransaction.account?.name,
        categoryName: quickTransaction.category?.name,
      });

      if (quickTransaction.type === "EXPENSE" && quickTransaction.categoryId) {
        await notifyBudgetThresholdCrossed(user.id, { categoryId: quickTransaction.categoryId, date: quickTransaction.date, appliedAmount: Number(quickTransaction.amount) });
      }
    } catch (error) {
      logger.error("quick_transactions.notify_failed", { transactionId: quickTransaction.id, err: error });
    }
  });

  return successResponse(quickTransaction, "Quick transaction created successfully");
});

import { NextRequest } from "next/server";
import { applyBalanceChange, applyBudgetChange, logger, prisma, requireAuth, TRANSACTION_INCLUDE, validateAccount, validateCategory, validateCreditCardRules, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateTransactionSchema } from "@/types";

export const PUT = withApi<{ id: string }>("transactions.update", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = updateTransactionSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Transaction not found", 404);

  const data = validation.data;

  const newAccountId = data.accountId ?? existing.accountId;
  const newType = data.type ?? existing.type;

  const newToAccountId = newType === "TRANSFER" ? ("toAccountId" in data ? data.toAccountId : (existing.toAccountId ?? undefined)) : undefined;

  const { error: accountError } = await validateAccount(user.id, newAccountId, newToAccountId);
  if (accountError) return errorResponse(accountError, 404);

  const creditCardError = await validateCreditCardRules(newAccountId, newType, newToAccountId);
  if (creditCardError) return errorResponse(creditCardError, 422);

  const newCategoryId = newType !== "TRANSFER" ? ("categoryId" in data ? data.categoryId : (existing.categoryId ?? undefined)) : undefined;

  const { error: categoryError } = await validateCategory(user.id, newCategoryId);
  if (categoryError) return errorResponse(categoryError, 404);

  const transaction = await prisma.$transaction(async (tx) => {
    await applyBalanceChange(tx, existing, "reverse");
    await applyBudgetChange(tx, user.id, existing, "reverse");

    const updated = await tx.transaction.update({
      where: { id },
      data: {
        ...data,
        ...(data.date && { date: new Date(data.date) }),
        ...(data.type && data.type !== "TRANSFER" && { toAccountId: null }),
        ...(data.type === "TRANSFER" && !("categoryId" in data) && { categoryId: null }),
      },
      include: TRANSACTION_INCLUDE,
    });

    await applyBalanceChange(tx, updated, "apply");
    await applyBudgetChange(tx, user.id, updated, "apply");

    return updated;
  });

  // Balances are rewritten here, so the before/after amounts are what you need
  // when a user reports that an account total looks wrong.
  logger.info("transactions.updated", {
    transactionId: id,
    fields: Object.keys(data),
    previous: { type: existing.type, amount: Number(existing.amount), accountId: existing.accountId },
    current: { type: transaction.type, amount: Number(transaction.amount), accountId: transaction.accountId },
  });

  return successResponse(transaction, "Transaction updated successfully");
});

export const DELETE = withApi<{ id: string }>("transactions.delete", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const transaction = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!transaction) return errorResponse("Transaction not found", 404);

  await prisma.$transaction(async (tx) => {
    await applyBalanceChange(tx, transaction, "reverse");
    await applyBudgetChange(tx, user.id, transaction, "reverse");
    await tx.transaction.delete({ where: { id } });
  });

  logger.info("transactions.deleted", {
    transactionId: id,
    type: transaction.type,
    amount: Number(transaction.amount),
    accountId: transaction.accountId,
  });

  return successResponse(null, "Transaction deleted successfully");
});

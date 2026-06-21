import { NextRequest } from "next/server";
import { applyBalanceChange, applyBudgetChange, prisma, requireAuth, TRANSACTION_INCLUDE, validateAccount, validateCategory, validateCreditCardRules, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateTransactionSchema } from "@/types";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
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

      return successResponse(transaction, "Transaction updated successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { id } = await params;

      const transaction = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
      if (!transaction) return errorResponse("Transaction not found", 404);

      await prisma.$transaction(async (tx) => {
        await applyBalanceChange(tx, transaction, "reverse");
        await applyBudgetChange(tx, user.id, transaction, "reverse");
        await tx.transaction.delete({ where: { id } });
      });

      return successResponse(null, "Transaction deleted successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

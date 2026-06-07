import { NextRequest } from "next/server";

import { applyBalanceChange, applyBudgetChange, prisma, TRANSACTION_INCLUDE, validateAccount, validateCategory, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse, validationErrorResponse } from "@/utils";

import z from "zod";

import { quickTransactionSchema } from "@/types";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const email = searchParams.get("email");

      const quickTransactions = await prisma.user.findUnique({
        where: { email: email as string },
        select: {
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
            },
          },
        },
      });

      if (!quickTransactions) return errorResponse("Email not found. Please enter correct email!", 404);

      return successResponse(quickTransactions);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
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

      return successResponse(quickTransaction, "Quick transaction created successfully");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

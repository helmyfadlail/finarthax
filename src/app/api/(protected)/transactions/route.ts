import { NextRequest } from "next/server";

import { applyBalanceChange, applyBudgetChange, prisma, requireAuth, TRANSACTION_INCLUDE, validateAccount, validateCategory, validateCreditCardRules, withMaintenanceGuard } from "@/lib";

import { Prisma } from "prisma-client/client";

import { errorResponse, successResponse, validationErrorResponse } from "@/utils";

import z from "zod";

import { transactionFilterSchema, transactionSchema } from "@/types";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
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
        ...(startDate && { date: { gte: new Date(startDate) } }),
        ...(endDate && { date: { lte: new Date(endDate) } }),
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

      return successResponse({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
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

      return successResponse(transaction, "Transaction created successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

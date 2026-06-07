import { NextRequest } from "next/server";

import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";

import { Prisma } from "prisma-client/client";

import { errorResponse, successResponse, validationErrorResponse } from "@/utils";

import z from "zod";

import { budgetSchema } from "@/types";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { searchParams } = new URL(req.url);

      const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
      const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const categoryId = searchParams.get("categoryId");

      const skip = (page - 1) * limit;

      const where: Prisma.BudgetWhereInput = { userId: user.id, month, year };

      if (categoryId) where.categoryId = categoryId;

      const total = await prisma.budget.count({ where });

      const budgets = await prisma.budget.findMany({
        where,
        include: { category: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      });

      const totalPages = Math.ceil(total / limit);

      return successResponse({
        data: budgets,
        pagination: {
          page,
          limit,
          total,
          totalPages,
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
      const validation = budgetSchema.safeParse(body);

      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const data = validation.data;

      const startDate = new Date(data.year, data.month - 1, 1);
      const endDate = new Date(data.year, data.month, 0);

      const spent = await prisma.transaction.aggregate({
        where: {
          userId: user.id,
          categoryId: data.categoryId,
          type: "EXPENSE",
          date: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      });

      const budget = await prisma.budget.upsert({
        where: {
          userId_categoryId_month_year: {
            userId: user.id,
            categoryId: data.categoryId,
            month: data.month,
            year: data.year,
          },
        },
        create: {
          userId: user.id,
          categoryId: data.categoryId,
          amount: data.amount,
          spent: spent._sum.amount || 0,
          month: data.month,
          year: data.year,
        },
        update: {
          amount: data.amount,
        },
        include: { category: true },
      });

      return successResponse(budget, "Budget created successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

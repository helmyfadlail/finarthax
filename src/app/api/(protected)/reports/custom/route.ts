import { NextRequest } from "next/server";

import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse } from "@/utils";

import { z } from "zod";

const customReportSchema = z
  .object({
    startDate: z.string().min(1, "Start date required"),
    endDate: z.string().min(1, "End date required"),
  })
  .refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
  });

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const body = await req.json();
      const validation = customReportSchema.safeParse(body);

      if (!validation.success) return errorResponse("Invalid date range", 400);

      const { startDate: startStr, endDate: endStr } = validation.data;
      const startDate = new Date(startStr);
      const endDate = new Date(endStr + "T23:59:59");

      const transactions = await prisma.transaction.findMany({
        where: { userId: user.id, date: { gte: startDate, lte: endDate } },
        include: { category: true, account: true, toAccount: true },
        orderBy: { date: "desc" },
      });

      // ── Totals ─────────────────────────────────────────────────────────────
      const income = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
      const expense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
      const transfer = transactions.filter((t) => t.type === "TRANSFER").reduce((s, t) => s + Number(t.amount), 0);
      const balance = income - expense;

      const daySpan = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));
      const avgDailyExpense = expense / daySpan;

      const counts = {
        income: transactions.filter((t) => t.type === "INCOME").length,
        expense: transactions.filter((t) => t.type === "EXPENSE").length,
        transfer: transactions.filter((t) => t.type === "TRANSFER").length,
        total: transactions.length,
      };

      // ── Category breakdown (EXPENSE only, nullable categoryId safe) ────────
      const categoryTotals = new Map<
        string,
        {
          name: string;
          icon?: string;
          color?: string;
          income: number;
          expense: number;
        }
      >();
      transactions
        .filter((t) => t.type !== "TRANSFER" && t.categoryId && t.category)
        .forEach((t) => {
          const prev = categoryTotals.get(t.categoryId!) ?? {
            name: t.category!.name,
            icon: t.category!.icon ?? undefined,
            color: t.category!.color ?? undefined,
            income: 0,
            expense: 0,
          };
          if (t.type === "INCOME") prev.income += Number(t.amount);
          if (t.type === "EXPENSE") prev.expense += Number(t.amount);
          categoryTotals.set(t.categoryId!, prev);
        });

      const categoryBreakdown = Array.from(categoryTotals.values()).sort((a, b) => b.expense - a.expense);

      // ── Account breakdown (includes TRANSFER flow) ─────────────────────────
      const accountTotals = new Map<
        string,
        {
          name: string;
          icon?: string;
          type: string;
          income: number;
          expense: number;
          transferOut: number;
          transferIn: number;
        }
      >();

      const ensureAccount = (id: string, tx: (typeof transactions)[0]) => {
        if (!accountTotals.has(id)) {
          accountTotals.set(id, {
            name: tx.account.name,
            icon: tx.account.icon ?? undefined,
            type: tx.account.type,
            income: 0,
            expense: 0,
            transferOut: 0,
            transferIn: 0,
          });
        }
        return accountTotals.get(id)!;
      };

      transactions.forEach((t) => {
        const acc = ensureAccount(t.accountId, t);
        if (t.type === "INCOME") acc.income += Number(t.amount);
        if (t.type === "EXPENSE") acc.expense += Number(t.amount);
        if (t.type === "TRANSFER") acc.transferOut += Number(t.amount);

        if (t.type === "TRANSFER" && t.toAccountId && t.toAccount) {
          if (!accountTotals.has(t.toAccountId)) {
            accountTotals.set(t.toAccountId, {
              name: t.toAccount.name,
              icon: t.toAccount.icon ?? undefined,
              type: t.toAccount.type,
              income: 0,
              expense: 0,
              transferOut: 0,
              transferIn: 0,
            });
          }
          accountTotals.get(t.toAccountId)!.transferIn += Number(t.amount);
        }
      });

      const accountBreakdown = Array.from(accountTotals.values());

      const dailyTotals = new Map<string, { income: number; expense: number; transfer: number }>();
      transactions.forEach((t) => {
        const key = t.date.toISOString().split("T")[0];
        const prev = dailyTotals.get(key) ?? { income: 0, expense: 0, transfer: 0 };
        if (t.type === "INCOME") prev.income += Number(t.amount);
        if (t.type === "EXPENSE") prev.expense += Number(t.amount);
        if (t.type === "TRANSFER") prev.transfer += Number(t.amount);
        dailyTotals.set(key, prev);
      });

      const dailyTrend = Array.from(dailyTotals.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const transferWithDest = transactions.filter((t) => t.type === "TRANSFER" && t.toAccountId);
      const transferSummary = {
        totalMoved: transfer,
        totalReceived: transferWithDest.reduce((s, t) => s + Number(t.amount), 0),
        withdrawals: transfer - transferWithDest.reduce((s, t) => s + Number(t.amount), 0),
        count: counts.transfer,
      };

      return successResponse({
        dateRange: { startDate: startStr, endDate: endStr },
        summary: {
          income,
          expense,
          transfer,
          balance,
          transactionCount: counts.total,
          counts,
          avgDailyExpense,
          savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
        },
        categoryBreakdown,
        accountBreakdown,
        dailyTrend,
        transferSummary,
        transactions,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

import { NextRequest } from "next/server";

import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse } from "@/utils";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
      const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfPrevMonth = new Date(currentYear, currentMonth, 0);

      const [currentIncome, currentExpense, currentTransfer, prevIncome, prevExpense, prevTransfer] = await Promise.all([
        prisma.transaction.aggregate({
          where: { userId: user.id, type: "INCOME", date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: "EXPENSE", date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: "TRANSFER", date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: "INCOME", date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: "EXPENSE", date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: "TRANSFER", date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
          _sum: { amount: true },
        }),
      ]);

      const cur = {
        income: Number(currentIncome._sum.amount ?? 0),
        expense: Number(currentExpense._sum.amount ?? 0),
        transfer: Number(currentTransfer._sum.amount ?? 0),
      };

      const prev = {
        income: Number(prevIncome._sum.amount ?? 0),
        expense: Number(prevExpense._sum.amount ?? 0),
        transfer: Number(prevTransfer._sum.amount ?? 0),
      };

      const currentBalance = cur.income - cur.expense;
      const prevBalance = prev.income - prev.expense;

      const pct = (current: number, previous: number) => (previous > 0 ? ((current - previous) / previous) * 100 : 0);

      const changes = {
        income: pct(cur.income, prev.income),
        expense: pct(cur.expense, prev.expense),
        transfer: pct(cur.transfer, prev.transfer),
        balance: prevBalance !== 0 ? ((currentBalance - prevBalance) / Math.abs(prevBalance)) * 100 : 0,
      };

      const recentTransactions = await prisma.transaction.findMany({
        where: { userId: user.id },
        include: {
          category: true,
          account: true,
          toAccount: true,
        },
        orderBy: { date: "desc" },
        take: 5,
      });

      const accounts = await prisma.account.findMany({ where: { userId: user.id }, orderBy: { isDefault: "desc" } });

      const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

      const [incomeCount, expenseCount, transferCount] = await Promise.all([
        prisma.transaction.count({
          where: { userId: user.id, type: "INCOME", date: { gte: startOfMonth, lte: endOfMonth } },
        }),
        prisma.transaction.count({
          where: { userId: user.id, type: "EXPENSE", date: { gte: startOfMonth, lte: endOfMonth } },
        }),
        prisma.transaction.count({
          where: { userId: user.id, type: "TRANSFER", date: { gte: startOfMonth, lte: endOfMonth } },
        }),
      ]);

      return successResponse({
        currentMonth: {
          income: cur.income,
          expense: cur.expense,
          transfer: cur.transfer,
          balance: currentBalance,
          counts: {
            income: incomeCount,
            expense: expenseCount,
            transfer: transferCount,
            total: incomeCount + expenseCount + transferCount,
          },
        },
        previousMonth: {
          income: prev.income,
          expense: prev.expense,
          transfer: prev.transfer,
          balance: prevBalance,
        },
        changes,
        totalBalance,
        accounts,
        recentTransactions,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

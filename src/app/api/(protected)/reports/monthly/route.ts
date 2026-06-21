import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { searchParams } = new URL(req.url);

      const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
      const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const transactions = await prisma.transaction.findMany({
        where: { userId: user.id, date: { gte: startDate, lte: endDate } },
        include: { category: true, account: true, toAccount: true },
        orderBy: { date: "desc" },
      });

      const income = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
      const expense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
      const transfer = transactions.filter((t) => t.type === "TRANSFER").reduce((s, t) => s + Number(t.amount), 0);
      const balance = income - expense;
      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

      const daysInMonth = endDate.getDate();
      const avgDailyExpense = expense > 0 ? expense / daysInMonth : 0;

      const largestTransaction = transactions.length > 0 ? Math.max(...transactions.map((t) => Number(t.amount))) : 0;

      const counts = {
        income: transactions.filter((t) => t.type === "INCOME").length,
        expense: transactions.filter((t) => t.type === "EXPENSE").length,
        transfer: transactions.filter((t) => t.type === "TRANSFER").length,
        total: transactions.length,
      };

      const categoryTotals = new Map<string, { name: string; icon?: string; color?: string; total: number }>();
      transactions
        .filter((t) => t.type === "EXPENSE" && t.categoryId && t.category)
        .forEach((t) => {
          const prev = categoryTotals.get(t.categoryId!) ?? {
            name: t.category!.name,
            icon: t.category!.icon ?? undefined,
            color: t.category!.color ?? undefined,
            total: 0,
          };
          categoryTotals.set(t.categoryId!, { ...prev, total: prev.total + Number(t.amount) });
        });

      const topCategories = Array.from(categoryTotals.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const dailySpending = new Map<string, number>();
      transactions
        .filter((t) => t.type === "EXPENSE")
        .forEach((t) => {
          const key = t.date.toISOString().split("T")[0];
          dailySpending.set(key, (dailySpending.get(key) ?? 0) + Number(t.amount));
        });

      const spendingTrend = Array.from(dailySpending.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const transferWithDest = transactions.filter((t) => t.type === "TRANSFER" && t.toAccountId);
      const transferWithoutDest = transactions.filter((t) => t.type === "TRANSFER" && !t.toAccountId);

      const transferSummary = {
        totalMoved: transfer,
        totalReceived: transferWithDest.reduce((s, t) => s + Number(t.amount), 0),
        withdrawals: transferWithoutDest.reduce((s, t) => s + Number(t.amount), 0),
        count: counts.transfer,
      };

      return successResponse({
        summary: {
          income,
          expense,
          transfer,
          balance,
          savingsRate,
          avgDailyExpense,
          largestTransaction,
          transactionCount: counts.total,
          counts,
        },
        topCategories,
        spendingTrend,
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

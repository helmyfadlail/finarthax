import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { searchParams } = new URL(req.url);
      const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      const transactions = await prisma.transaction.findMany({
        where: { userId: user.id, date: { gte: startDate, lte: endDate } },
        include: { category: true, account: true, toAccount: true },
      });

      const monthlyBreakdown = Array.from({ length: 12 }, (_, m) => {
        const monthStart = new Date(year, m, 1);
        const monthEnd = new Date(year, m + 1, 0, 23, 59, 59);
        const monthly = transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd);

        const income = monthly.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
        const expense = monthly.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
        const transfer = monthly.filter((t) => t.type === "TRANSFER").reduce((s, t) => s + Number(t.amount), 0);

        return {
          month: monthStart.toLocaleString("id-ID", { month: "short" }),
          income,
          expense,
          transfer,
          balance: income - expense,
        };
      });

      const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
      const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
      const totalTransfer = transactions.filter((t) => t.type === "TRANSFER").reduce((s, t) => s + Number(t.amount), 0);

      const yearlyBalance = totalIncome - totalExpense;
      const avgMonthlyIncome = totalIncome / 12;
      const avgMonthlyExpense = totalExpense / 12;
      const avgMonthlyTransfer = totalTransfer / 12;
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

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
        .slice(0, 10);

      const monthsWithData = monthlyBreakdown.filter((m) => m.income > 0 || m.expense > 0);
      const bestMonth = monthsWithData.reduce((best, m) => (m.balance > best.balance ? m : best), monthsWithData[0] ?? null);
      const worstMonth = monthsWithData.reduce((worst, m) => (m.balance < worst.balance ? m : worst), monthsWithData[0] ?? null);

      const transferWithDest = transactions.filter((t) => t.type === "TRANSFER" && t.toAccountId);
      const transferSummary = {
        totalMoved: totalTransfer,
        totalReceived: transferWithDest.reduce((s, t) => s + Number(t.amount), 0),
        withdrawals: totalTransfer - transferWithDest.reduce((s, t) => s + Number(t.amount), 0),
        count: counts.transfer,
      };

      return successResponse({
        summary: {
          totalIncome,
          totalExpense,
          totalTransfer,
          yearlyBalance,
          avgMonthlyIncome,
          avgMonthlyExpense,
          avgMonthlyTransfer,
          savingsRate,
          transactionCount: counts.total,
          counts,
          bestMonth: bestMonth ? { month: bestMonth.month, balance: bestMonth.balance } : null,
          worstMonth: worstMonth ? { month: worstMonth.month, balance: worstMonth.balance } : null,
        },
        monthlyBreakdown,
        topCategories,
        transferSummary,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

import { logger, prisma, requireAuth, withApi } from "@/lib";
import { successResponse } from "@/utils";

export const GET = withApi("dashboard.charts", async () => {
  const user = await requireAuth();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // This endpoint issues a query per month plus one per category, so it is the
  // most likely place for dashboard slowness - time it explicitly.
  const doneMonthly = logger.time("dashboard.charts.monthly_series");

  const monthlyData = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const month = date.getMonth();
    const year = date.getFullYear();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const [income, expense, transfer] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "INCOME", date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "EXPENSE", date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "TRANSFER", date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
    ]);

    monthlyData.push({
      month: date.toLocaleString("id-ID", { month: "short", year: "numeric" }),
      income: Number(income._sum.amount ?? 0),
      expense: Number(expense._sum.amount ?? 0),
      transfer: Number(transfer._sum.amount ?? 0),
    });
  }

  doneMonthly({ months: monthlyData.length });

  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

  const expensesByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId: user.id,
      type: "EXPENSE",
      categoryId: { not: null },
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    _sum: { amount: true },
  });

  const categoryData = await Promise.all(
    expensesByCategory.map(async (item) => {
      const category = await prisma.category.findUnique({ where: { id: item.categoryId! } });
      return {
        name: category?.name ?? "Unknown",
        value: Number(item._sum.amount ?? 0),
        color: category?.color ?? "#6b7280",
      };
    }),
  );

  const budgets = await prisma.budget.findMany({
    where: { userId: user.id, month: currentMonth + 1, year: currentYear },
    include: { category: true },
  });

  const budgetProgress = budgets.map((budget) => ({
    category: budget.category.name,
    budget: Number(budget.amount),
    spent: Number(budget.spent),
    percentage: Number(budget.amount) > 0 ? Math.min((Number(budget.spent) / Number(budget.amount)) * 100, 100) : 0,
  }));

  const [transferOut, transferIn] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId: user.id,
        type: "TRANSFER",
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId: user.id,
        type: "TRANSFER",
        toAccountId: { not: null },
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  const transferSummary = {
    totalMoved: Number(transferOut._sum.amount ?? 0),
    totalReceived: Number(transferIn._sum.amount ?? 0),
    withdrawals: Number(transferOut._sum.amount ?? 0) - Number(transferIn._sum.amount ?? 0),
  };

  return successResponse({
    monthlyData,
    categoryData,
    budgetProgress,
    transferSummary,
  });
});

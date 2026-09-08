import { convertToBase, getExchangeRates, logger, prisma, requireAuth, sumTransactionAmounts, withApi } from "@/lib";
import { BASE_CURRENCY } from "@/static";
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
      sumTransactionAmounts({ userId: user.id, type: "INCOME", date: { gte: startDate, lte: endDate } }),
      sumTransactionAmounts({ userId: user.id, type: "EXPENSE", date: { gte: startDate, lte: endDate } }),
      sumTransactionAmounts({ userId: user.id, type: "TRANSFER", date: { gte: startDate, lte: endDate } }),
    ]);

    monthlyData.push({
      month: date.toLocaleString("id-ID", { month: "short", year: "numeric" }),
      income,
      expense,
      transfer,
    });
  }

  doneMonthly({ months: monthlyData.length });

  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

  const expenseTransactions = await prisma.transaction.findMany({
    where: { userId: user.id, type: "EXPENSE", categoryId: { not: null }, date: { gte: startOfMonth, lte: endOfMonth } },
    select: { amount: true, categoryId: true, account: { select: { currency: true } }, category: { select: { name: true, color: true } } },
  });

  const categoryRates = expenseTransactions.some((t) => t.account.currency !== BASE_CURRENCY) ? await getExchangeRates() : null;

  const categoryTotals = new Map<string, { name: string; color: string; value: number }>();
  for (const t of expenseTransactions) {
    const prev = categoryTotals.get(t.categoryId!) ?? { name: t.category?.name ?? "Unknown", color: t.category?.color ?? "#6b7280", value: 0 };
    prev.value += convertToBase(t.amount.toNumber(), t.account.currency, categoryRates);
    categoryTotals.set(t.categoryId!, prev);
  }

  const categoryData = Array.from(categoryTotals.values());

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

  const transfers = await prisma.transaction.findMany({
    where: { userId: user.id, type: "TRANSFER", date: { gte: startOfMonth, lte: endOfMonth } },
    select: { amount: true, convertedAmount: true, toAccountId: true, account: { select: { currency: true } }, toAccount: { select: { currency: true } } },
  });

  const transferRates = transfers.some((t) => t.account.currency !== BASE_CURRENCY || (t.toAccount && t.toAccount.currency !== BASE_CURRENCY)) ? await getExchangeRates() : null;

  // "Moved" is measured at the source account (what left it); "received" at the destination
  // account (what landed there) - the two differ whenever a transfer crossed currencies.
  const totalMoved = transfers.reduce((sum, t) => sum + convertToBase(t.amount.toNumber(), t.account.currency, transferRates), 0);
  const totalReceived = transfers
    .filter((t) => t.toAccountId)
    .reduce((sum, t) => sum + convertToBase((t.convertedAmount ?? t.amount).toNumber(), t.toAccount?.currency ?? BASE_CURRENCY, transferRates), 0);

  const transferSummary = {
    totalMoved,
    totalReceived,
    withdrawals: totalMoved - totalReceived,
  };

  return successResponse({
    monthlyData,
    categoryData,
    budgetProgress,
    transferSummary,
  });
});

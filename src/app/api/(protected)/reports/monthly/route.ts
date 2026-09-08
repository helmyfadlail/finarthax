import { NextRequest } from "next/server";
import { convertToBase, getExchangeRates, logger, prisma, requireAuth, withApi } from "@/lib";
import { BASE_CURRENCY } from "@/static";
import { successResponse } from "@/utils";

export const GET = withApi("reports.monthly", async (req: NextRequest) => {
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

  // Every total below is normalized to BASE_CURRENCY so amounts from different-currency accounts
  // can be added together - live rates are only fetched if a foreign-currency account is involved.
  const rates = transactions.some((t) => t.account.currency !== BASE_CURRENCY) ? await getExchangeRates() : null;
  const amt = (t: (typeof transactions)[number]) => convertToBase(t.amount.toNumber(), t.account.currency, rates);

  const income = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + amt(t), 0);
  const expense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + amt(t), 0);
  const transfer = transactions.filter((t) => t.type === "TRANSFER").reduce((s, t) => s + amt(t), 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

  const daysInMonth = endDate.getDate();
  const avgDailyExpense = expense > 0 ? expense / daysInMonth : 0;

  const largestTransaction = transactions.length > 0 ? Math.max(...transactions.map((t) => amt(t))) : 0;

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
      categoryTotals.set(t.categoryId!, { ...prev, total: prev.total + amt(t) });
    });

  const topCategories = Array.from(categoryTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const dailySpending = new Map<string, number>();
  transactions
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => {
      const key = t.date.toISOString().split("T")[0];
      dailySpending.set(key, (dailySpending.get(key) ?? 0) + amt(t));
    });

  const spendingTrend = Array.from(dailySpending.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const transferWithDest = transactions.filter((t) => t.type === "TRANSFER" && t.toAccountId);
  const transferWithoutDest = transactions.filter((t) => t.type === "TRANSFER" && !t.toAccountId);

  const transferSummary = {
    totalMoved: transfer,
    // Measured at the destination account - the converted amount when the transfer crossed currencies.
    totalReceived: transferWithDest.reduce((s, t) => s + convertToBase((t.convertedAmount ?? t.amount).toNumber(), t.toAccount?.currency ?? BASE_CURRENCY, rates), 0),
    withdrawals: transferWithoutDest.reduce((s, t) => s + amt(t), 0),
    count: counts.transfer,
  };

  // Report endpoints load the full month into memory - the row count explains
  // both the response size and any latency spike.
  logger.debug("reports.monthly_built", { month, year, transactions: counts.total });

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
});

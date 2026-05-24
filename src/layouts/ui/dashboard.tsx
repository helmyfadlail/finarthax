"use client";

import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Tooltip as ReTooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

import { apiClient } from "@/utils";

import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton, useCurrency } from "@/components";

import type { ApiResponse, DashboardCharts, DashboardSummary, Transaction, TransactionType } from "@/types";

interface SummaryCardProps {
  title: string;
  amount: number;
  change: number;
  icon: string;
  type: "income" | "expense" | "transfer" | "balance";
  count?: number;
}

interface TransactionItemProps {
  transaction: Transaction;
}

interface BudgetProgressProps {
  budget: {
    category: string;
    spent: number;
    budget: number;
    percentage: number;
    icon?: string;
  };
}

const TX_CONFIG: Record<TransactionType, { color: string; bg: string; iconBg: string; icon: string; badge: "success" | "error" | "info"; prefix: string }> = {
  INCOME: { color: "text-emerald-600", bg: "bg-emerald-50", iconBg: "bg-emerald-100", icon: "💰", badge: "success", prefix: "+" },
  EXPENSE: { color: "text-rose-600", bg: "bg-rose-50", iconBg: "bg-rose-100", icon: "💳", badge: "error", prefix: "-" },
  TRANSFER: { color: "text-sky-600", bg: "bg-sky-50", iconBg: "bg-sky-100", icon: "🔄", badge: "info", prefix: "⇄" },
};

const CHART_COLORS = {
  income: "#10b981",
  expense: "#f43f5e",
  transfer: "#0ea5e9",
  grid: "#f1f5f9",
  text: "#94a3b8",
};

const PIE_PALETTE = ["#f43f5e", "#fb923c", "#facc15", "#4ade80", "#34d399", "#22d3ee", "#818cf8", "#e879f9"];

const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, change, icon, type, count }) => {
  const t = useTranslations("dashboardPage");
  const { format } = useCurrency();

  const isPositive = type === "expense" ? change <= 0 : type === "transfer" ? true : change >= 0;
  const colorClass = type === "income" ? "text-emerald-600" : type === "expense" ? "text-rose-600" : type === "transfer" ? "text-sky-600" : "text-primary-900";
  const cardBg =
    type === "income"
      ? "from-emerald-50 to-white border-emerald-100"
      : type === "expense"
        ? "from-rose-50 to-white border-rose-100"
        : type === "transfer"
          ? "from-sky-50 to-white border-sky-100"
          : "from-primary-50 to-white border-primary-100";
  const changeColor = type === "transfer" ? "text-sky-500" : isPositive ? "text-emerald-600" : "text-rose-600";

  return (
    <Card variant="elevated" className={`bg-linear-to-br ${cardBg} hover:shadow-xl transition-all duration-300 border`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="pr-1 text-xs tracking-wide uppercase truncate text-primary-500">{title}</span>
          <span className="text-lg lg:text-xl shrink-0">{icon}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-base sm:text-xl md:text-2xl lg:text-xl xl:text-3xl font-bold ${colorClass} mb-1.5 tabular-nums truncate`}>{format(amount)}</p>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {type !== "transfer" ? (
              <>
                <span className={`text-xs font-medium ${changeColor}`}>
                  {change >= 0 ? "↗" : "↘"} {Math.abs(change).toFixed(1)}%
                </span>
                <span className="hidden text-xs md:inline text-primary-400">{t("vsLastMonth")}</span>
              </>
            ) : (
              <span className="text-xs font-medium text-sky-500">⇄ {t("neutral")}</span>
            )}
          </div>
          {count !== undefined && <span className="text-xs text-primary-400 tabular-nums shrink-0">{count} txn</span>}
        </div>
      </CardContent>
    </Card>
  );
};

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const t = useTranslations("dashboardPage");
  const { format } = useCurrency();

  const type = transaction.type as TransactionType;
  const config = TX_CONFIG[type] ?? TX_CONFIG.EXPENSE;
  const isTransfer = type === "TRANSFER";

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 sm:gap-3 sm:p-4 rounded-xl bg-neutral hover:bg-neutral-100 hover:shadow-sm transition-all group">
      <div className="flex items-center flex-1 min-w-0 gap-2 sm:gap-3">
        <div
          className={`flex items-center justify-center shrink-0 w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-base sm:text-xl rounded-full ${config.iconBg} transition-transform group-hover:scale-110`}
        >
          {isTransfer ? "🔄" : (transaction.category?.icon ?? "💰")}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold truncate sm:text-sm text-primary-900">{transaction.description || t("noDescription")}</h4>
          <p className="text-xs truncate text-primary-500">
            {isTransfer ? (transaction.toAccount ? `${transaction.account?.name} → ${transaction.toAccount.name}` : transaction.account?.name) : (transaction.category?.name ?? t("uncategorized"))}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-sm sm:text-base md:text-lg font-bold ${config.color} tabular-nums`}>
          {config.prefix}
          {format(transaction.amount)}
        </p>
        <Badge variant={config.badge} className="hidden mt-1 sm:inline-flex">
          {config.icon} {t(type.toLowerCase() as "income" | "expense" | "transfer")}
        </Badge>
      </div>
    </div>
  );
};

const BudgetProgress: React.FC<BudgetProgressProps> = ({ budget }) => {
  const t = useTranslations("dashboardPage");
  const { format } = useCurrency();

  const status = useMemo(() => {
    if (budget.percentage >= 100) return { bar: "from-rose-400 to-rose-600", text: "text-rose-600", label: t("budgetStatus.overBudget") };
    if (budget.percentage >= 80) return { bar: "from-amber-400 to-amber-500", text: "text-amber-600", label: t("budgetStatus.nearLimit") };
    return { bar: "from-emerald-400 to-emerald-500", text: "text-emerald-600", label: t("budgetStatus.onTrack") };
  }, [budget.percentage, t]);

  return (
    <div className="p-2.5 sm:p-4 rounded-xl bg-neutral hover:bg-neutral-50 hover:border-primary-100 border border-transparent transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center min-w-0 gap-1.5 sm:gap-2">
          <span className="text-base sm:text-xl shrink-0">{budget.icon ?? "📊"}</span>
          <span className="text-xs font-semibold truncate sm:text-sm text-primary-900">{budget.category}</span>
        </div>
        <div className="ml-2 text-right shrink-0">
          <p className="text-xs font-medium sm:text-sm text-primary-900 tabular-nums">{format(budget.spent)}</p>
          <p className="text-xs text-primary-400 tabular-nums">
            {t("of")} {format(budget.budget)}
          </p>
        </div>
      </div>
      <div className="relative w-full h-2 sm:h-2.5 overflow-hidden rounded-full bg-primary-100">
        <div className={`h-full rounded-full bg-linear-to-r ${status.bar} transition-all duration-700`} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
        <span className="text-xs text-primary-400 tabular-nums">
          {budget.percentage?.toFixed(1)}% {t("used")}
        </span>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}> = ({ icon, title, description, actionLabel, actionHref }) => {
  const router = useRouter();
  return (
    <div className="px-3 py-8 text-center sm:py-12 sm:px-4">
      <div className="mb-2 text-3xl sm:text-5xl sm:mb-3">{icon}</div>
      <h3 className="mb-1.5 text-sm sm:text-lg font-bold text-primary-900">{title}</h3>
      <p className="max-w-xs mx-auto mb-4 text-xs sm:text-sm text-primary-500 sm:mb-5">{description}</p>
      {actionLabel && actionHref && (
        <button onClick={() => router.push(actionHref)}>
          <Button variant="primary" size="md" className="w-full sm:w-auto">
            {actionLabel}
          </Button>
        </button>
      )}
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="px-1 space-y-3 sm:space-y-5">
    <Skeleton className="w-32 h-6 sm:w-56 sm:h-8" />
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 sm:h-32 md:h-36" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 sm:gap-5">
      <Skeleton className="h-52 sm:h-72" />
      <Skeleton className="h-52 sm:h-72" />
    </div>
    <Skeleton className="h-52 sm:h-80" />
  </div>
);

const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (v: number) => string;
}> = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-2.5 sm:p-3 text-xs bg-white border shadow-xl border-primary-100 rounded-xl">
      <p className="mb-1.5 font-semibold text-primary-700">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="capitalize text-primary-500">{p.name}:</span>
          <span className="font-semibold text-primary-900 tabular-nums">{formatter ? formatter(p.value) : p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const t = useTranslations("dashboardPage");
  const { format } = useCurrency();
  const router = useRouter();

  const { data: summary, isLoading: summaryLoading } = useQuery<ApiResponse<DashboardSummary>>({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiClient.get("/dashboard/summary"),
  });

  const { data: charts, isLoading: chartsLoading } = useQuery<ApiResponse<DashboardCharts>>({
    queryKey: ["dashboard", "charts"],
    queryFn: () => apiClient.get("/dashboard/charts"),
  });

  const isLoading = summaryLoading || chartsLoading;

  const currentMonth = summary?.data?.currentMonth;
  const changes = summary?.data?.changes;
  const counts = summary?.data?.currentMonth?.counts;
  const recentTxns = summary?.data?.recentTransactions ?? [];
  const accounts = summary?.data?.accounts ?? [];
  const totalBalance = summary?.data?.totalBalance ?? 0;
  const budgetProgress = charts?.data?.budgetProgress ?? [];
  const transferSummary = charts?.data?.transferSummary;

  const categoryData = useMemo(() => charts?.data?.categoryData ?? [], [charts?.data?.categoryData]);
  const monthlyData = useMemo(() => charts?.data?.monthlyData ?? [], [charts?.data?.monthlyData]);

  const currentMonthName = useMemo(() => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), []);

  const safeMonthlyData = useMemo(() => monthlyData.map((d) => ({ ...d, income: Number(d.income), expense: Number(d.expense), transfer: Number(d.transfer ?? 0) })), [monthlyData]);
  const safeCategoryData = useMemo(() => categoryData.map((d) => ({ ...d, value: Number(d.value) })), [categoryData]);
  const pieData = safeCategoryData.map((item, i) => ({ ...item, fill: item.color && item.color !== "#6b7280" ? item.color : PIE_PALETTE[i % PIE_PALETTE.length] }));

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900">{t("title")}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-primary-500">{t("welcome", { month: currentMonthName })}</p>
        </div>
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => router.push("/admin/dashboard/transactions")}>
          + {t("addTransaction")}
        </Button>
      </div>

      <div className="p-3 shadow-lg text-primary-900 rounded-2xl bg-linear-to-br from-primary-50 via-primary-100 to-primary-200 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-0.5 text-xs font-medium tracking-widest uppercase text-primary sm:text-sm">{t("totalBalance")}</p>
            <p className="text-2xl font-bold lg:text-3xl xl:text-4xl tabular-nums">{format(totalBalance)}</p>
            <p className="mt-0.5 text-xs text-primary sm:text-sm sm:mt-1">
              {accounts.length} {t("accountsLinked")}
            </p>
          </div>

          <div className="flex flex-col gap-0.5 xl:gap-1.5 sm:items-end">
            {accounts.slice(0, 3).map((acc) => (
              <div key={acc.id} className="flex items-center gap-2 text-xs lg:text-sm">
                <span className="opacity-70">{acc.icon}</span>
                <span className="truncate text-primary max-w-24 sm:max-w-40">{acc.name}</span>
                <span className="font-bold text-primary-900 tabular-nums">{format(acc.balance)}</span>
              </div>
            ))}
            {accounts.length > 3 && <span className="text-xs text-primary">+{accounts.length - 3} more</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <SummaryCard title={t("totalIncome")} amount={currentMonth?.income ?? 0} change={changes?.income ?? 0} icon="💰" type="income" count={counts?.income} />
        <SummaryCard title={t("totalExpenses")} amount={currentMonth?.expense ?? 0} change={changes?.expense ?? 0} icon="💳" type="expense" count={counts?.expense} />
        <SummaryCard title={t("transfer")} amount={currentMonth?.transfer ?? 0} change={changes?.transfer ?? 0} icon="🔄" type="transfer" count={counts?.transfer} />
        <SummaryCard title={t("netBalance")} amount={currentMonth?.balance ?? 0} change={changes?.balance ?? 0} icon="📊" type="balance" count={counts?.total} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm lg:text-base">📈 {t("monthlyOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            {safeMonthlyData.length === 0 ? (
              <EmptyState icon="📈" title={t("empty.charts.title")} description={t("empty.charts.description")} />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={safeMonthlyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.income} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS.income} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradTransfer" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.transfer} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.transfer} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_COLORS.text }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.text }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                  <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} formatter={(value) => <span className="capitalize text-primary-600">{value}</span>} />
                  <Area type="monotone" dataKey="income" stroke={CHART_COLORS.income} strokeWidth={2} fill="url(#gradIncome)" dot={false} activeDot={{ r: 3 }} />
                  <Area type="monotone" dataKey="expense" stroke={CHART_COLORS.expense} strokeWidth={2} fill="url(#gradExpense)" dot={false} activeDot={{ r: 3 }} />
                  <Area type="monotone" dataKey="transfer" stroke={CHART_COLORS.transfer} strokeWidth={2} fill="url(#gradTransfer)" dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm lg:text-base">🥧 {t("expenseBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {safeCategoryData.length === 0 ? (
              <EmptyState icon="🥧" title={t("empty.categories.title")} description={t("empty.categories.description")} />
            ) : (
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value" />
                    <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1">
                  {safeCategoryData.slice(0, 5).map((entry, index) => {
                    const color = entry.color && entry.color !== "#6b7280" ? entry.color : PIE_PALETTE[index % PIE_PALETTE.length];
                    const total = safeCategoryData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center min-w-0 gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <span className="truncate text-primary-600">{entry.name}</span>
                        </div>
                        <span className="ml-2 font-medium text-primary-900 tabular-nums">{pct}%</span>
                      </div>
                    );
                  })}
                  {safeCategoryData.length > 5 && <p className="text-xs text-right text-primary-400">+{safeCategoryData.length - 5} more</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm lg:text-base">📊 {t("monthlyComparison")}</CardTitle>
        </CardHeader>
        <CardContent>
          {safeMonthlyData.length === 0 ? (
            <EmptyState icon="📊" title={t("empty.charts.title")} description={t("empty.charts.description")} />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={safeMonthlyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_COLORS.text }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.text }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} formatter={(value) => <span className="capitalize text-primary-600">{value}</span>} />
                <Bar dataKey="income" fill={CHART_COLORS.income} radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" fill={CHART_COLORS.expense} radius={[3, 3, 0, 0]} />
                <Bar dataKey="transfer" fill={CHART_COLORS.transfer} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {transferSummary && transferSummary.totalMoved > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
          {[
            { label: t("transferFlow.totalMoved"), value: transferSummary.totalMoved, icon: "🔄", color: "text-sky-600" },
            { label: t("transferFlow.totalReceived"), value: transferSummary.totalReceived, icon: "📥", color: "text-emerald-600" },
            { label: t("transferFlow.withdrawals"), value: transferSummary.withdrawals, icon: "🏧", color: "text-amber-600" },
          ].map(({ label, value, icon, color }) => (
            <Card key={label} className="border bg-sky-50 border-sky-100">
              <CardContent className="pt-2.5 pb-2.5 sm:pt-4 sm:pb-4">
                <div className="flex items-center gap-1.5 mb-1 sm:gap-2">
                  <span className="text-base sm:text-lg">{icon}</span>
                  <span className="text-xs font-medium tracking-wide uppercase truncate text-sky-600">{label}</span>
                </div>
                <p className={`text-sm sm:text-lg lg:text-2xl font-bold tabular-nums ${color}`}>{format(value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-5">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xs sm:text-sm lg:text-base">📝 {t("recentTransactions")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push("/admin/dashboard/transactions")}>
                {t("viewAll")} →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentTxns.length === 0 ? (
              <EmptyState
                icon="📝"
                title={t("empty.transactions.title")}
                description={t("empty.transactions.description")}
                actionLabel={`+ ${t("addTransaction")}`}
                actionHref="/admin/dashboard/transactions"
              />
            ) : (
              <div className="pr-1 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-64 sm:max-h-80 lg:max-h-96">
                {recentTxns.slice(0, 5).map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xs sm:text-sm lg:text-base">🎯 {t("budgetProgress")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push("/admin/dashboard/budgets")}>
                {t("manage")} →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {budgetProgress.length === 0 ? (
              <EmptyState
                icon="🎯"
                title={t("empty.budgets.title")}
                description={t("empty.budgets.description")}
                actionLabel={`+ ${t("empty.budgets.action")}`}
                actionHref="/admin/dashboard/budgets"
              />
            ) : (
              <div className="pr-1 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-64 sm:max-h-80 lg:max-h-96">
                {budgetProgress.map((budget, index) => (
                  <BudgetProgress key={index} budget={budget} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-xs sm:text-sm lg:text-base">⚡ {t("quickAction")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
            {[
              {
                href: "/admin/dashboard/transactions",
                icon: "💳",
                bg: "bg-primary-50 hover:bg-primary-100 border-primary-200",
                title: t("quickActions.transactions.title"),
                subtitle: t("quickActions.transactions.subtitle"),
                text: "text-primary-900",
                sub: "text-primary-600",
              },
              {
                href: "/admin/dashboard/budgets",
                icon: "🎯",
                bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
                title: t("quickActions.budgets.title"),
                subtitle: t("quickActions.budgets.subtitle"),
                text: "text-emerald-900",
                sub: "text-emerald-600",
              },
              {
                href: "/admin/dashboard/goals",
                icon: "🏆",
                bg: "bg-sky-50 hover:bg-sky-100 border-sky-200",
                title: t("quickActions.goals.title"),
                subtitle: t("quickActions.goals.subtitle"),
                text: "text-sky-900",
                sub: "text-sky-600",
              },
              {
                href: "/admin/dashboard/reports",
                icon: "📊",
                bg: "bg-violet-50 hover:bg-violet-100 border-violet-200",
                title: t("quickActions.reports.title"),
                subtitle: t("quickActions.reports.subtitle"),
                text: "text-violet-900",
                sub: "text-violet-600",
              },
            ].map(({ href, icon, bg, title, subtitle, text, sub }) => (
              <button key={href} onClick={() => router.push(href)} className="block text-left">
                <div className={`p-2.5 sm:p-3 lg:p-4 rounded-xl ${bg} transition-colors border cursor-pointer group`}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xl transition-transform sm:text-2xl lg:text-3xl group-hover:scale-110 shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className={`font-semibold text-xs sm:text-sm ${text} truncate`}>{title}</p>
                      <p className={`text-xs ${sub} hidden sm:block truncate`}>{subtitle}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

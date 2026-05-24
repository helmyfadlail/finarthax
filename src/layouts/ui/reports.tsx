"use client";

import * as React from "react";

import { useTranslations } from "next-intl";

import { apiClient } from "@/utils";

import { useQuery, useMutation } from "@tanstack/react-query";

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from "recharts";

import { Card, CardContent, CardHeader, CardTitle, Select, Skeleton, useCurrency, Badge, Input, Button } from "@/components";

import type { ApiResponse, MonthlyReport, YearlyReport, CustomReport } from "@/types";

type ReportTab = "monthly" | "yearly" | "custom";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: "green" | "red" | "sky" | "primary";
  subtitle?: string;
}

interface CategoryBarProps {
  category: { name: string; total: number; icon?: string; color?: string };
  totalExpense: number;
  rank: number;
}

interface MonthBreakdownProps {
  month: { month: string; income: number; expense: number; transfer: number; balance: number };
  index: number;
}

interface TransferStripProps {
  summary: { totalMoved: number; totalReceived: number; withdrawals: number; count: number };
}

const YEAR_OPTIONS = ["2023", "2024", "2025", "2026"].map((y) => ({ value: y, label: y }));

const CHART_COLORS = {
  income: "#10b981",
  expense: "#f43f5e",
  transfer: "#0ea5e9",
  grid: "#f1f5f9",
  muted: "#94a3b8",
};

const COLOR_CONFIG = {
  green: { card: "from-emerald-50 to-white border-emerald-100", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  red: { card: "from-rose-50 to-white border-rose-100", text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
  sky: { card: "from-sky-50 to-white border-sky-100", text: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
  primary: { card: "from-primary-50 to-white border-primary-100", text: "text-primary-900", bg: "bg-primary-50", border: "border-primary-100" },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = "primary", subtitle }) => {
  const cfg = COLOR_CONFIG[color];

  return (
    <Card variant="elevated" className={`bg-linear-to-br ${cfg.bg} border ${cfg.border} transition-all hover:shadow-lg`}>
      <CardContent className="pt-4 pb-4 sm:pt-6">
        <div>
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <p className={`text-xs sm:text-sm font-medium uppercase tracking-wide text-primary-500`}>{label}</p>
            <span className="text-xl sm:text-2xl">{icon}</span>
          </div>
          <p className={`text-xl sm:text-2xl md:text-3xl font-bold tabular-nums ${cfg.text}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-1 text-primary-400`}>{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const CategoryBar: React.FC<CategoryBarProps> = ({ category, totalExpense, rank }) => {
  const { format } = useCurrency();
  const percentage = totalExpense > 0 ? (category.total / totalExpense) * 100 : 0;
  const barColor = category.color && category.color !== "#gray" ? category.color : "#f43f5e";

  return (
    <div className="p-3 transition-colors sm:p-4 rounded-xl bg-neutral hover:bg-neutral-100 group">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center flex-1 min-w-0 gap-2 sm:gap-3">
          <span className="w-5 text-xs font-bold text-primary-300 shrink-0">#{rank}</span>
          <span className="text-lg sm:text-2xl shrink-0">{category.icon ?? "📊"}</span>
          <span className="text-sm font-medium truncate sm:text-base text-primary-900">{category.name}</span>
        </div>
        <div className="ml-3 text-right shrink-0">
          <p className="text-sm font-bold sm:text-lg text-rose-600 tabular-nums">{format(category.total)}</p>
          <p className="text-xs text-primary-400">{percentage.toFixed(1)}%</p>
        </div>
      </div>
      <div className="w-full h-2 sm:h-2.5 overflow-hidden rounded-full bg-primary-100">
        <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${percentage}%`, background: barColor }} />
      </div>
    </div>
  );
};

const MonthBreakdown: React.FC<MonthBreakdownProps> = ({ month, index }) => {
  const t = useTranslations("reportsPage");
  const { format } = useCurrency();
  const isPositive = month.balance >= 0;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-xl transition-colors ${index % 2 === 0 ? "bg-neutral" : "bg-white"} hover:bg-neutral-100 gap-2 sm:gap-0`}
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-base sm:text-xl">📅</span>
        <span className="text-sm font-semibold sm:text-base text-primary-900 min-w-12">{month.month}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:gap-4 md:gap-6 sm:text-sm">
        <div className="text-center sm:text-right">
          <p className="font-bold text-emerald-600 tabular-nums">+{format(month.income)}</p>
          <p className="text-primary-400">{t("income")}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="font-bold text-rose-600 tabular-nums">-{format(month.expense)}</p>
          <p className="text-primary-400">{t("expense")}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="font-bold text-sky-600 tabular-nums">⇄{format(month.transfer)}</p>
          <p className="text-primary-400">{t("transfer")}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className={`font-bold tabular-nums ${isPositive ? "text-primary-900" : "text-rose-600"}`}>
            {isPositive ? "+" : ""}
            {format(month.balance)}
          </p>
          <p className="text-primary-400">{t("balance")}</p>
        </div>
      </div>
    </div>
  );
};

const TransferStrip: React.FC<TransferStripProps> = ({ summary }) => {
  const t = useTranslations("reportsPage");
  const { format } = useCurrency();
  if (summary.totalMoved === 0) return null;

  const items = [
    { label: t("transferSummary.totalMoved"), value: summary.totalMoved, icon: "🔄", color: "text-sky-600", raw: false },
    { label: t("transferSummary.totalReceived"), value: summary.totalReceived, icon: "📥", color: "text-emerald-600", raw: false },
    { label: t("transferSummary.withdrawals"), value: summary.withdrawals, icon: "🏧", color: "text-amber-600", raw: false },
    { label: t("transferSummary.count"), value: summary.count, icon: "🔢", color: "text-primary-600", raw: true },
  ];

  return (
    <Card className="border bg-sky-50 border-sky-100">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-sky-700">🔄 {t("transferSummary.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {items.map(({ label, value, icon, color, raw }) => (
            <div key={label} className="p-2 text-center bg-white shadow-sm sm:p-3 rounded-xl">
              <span className="text-xl sm:text-2xl">{icon}</span>
              <p className={`text-base sm:text-xl font-bold tabular-nums mt-1 ${color}`}>{raw ? value : format(value as number)}</p>
              <p className="text-xs text-primary-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (v: number) => string;
}> = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-primary-100 rounded-xl shadow-xl p-2.5 sm:p-3 text-xs sm:text-sm">
      <p className="font-semibold text-primary-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="capitalize text-primary-500">{p.name}:</span>
          <span className="font-semibold text-primary-900 tabular-nums">{formatter ? formatter(p.value) : p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => {
  const t = useTranslations("reportsPage");
  return (
    <div className="px-4 py-10 text-center sm:py-16">
      <div className="mb-3 text-4xl sm:mb-4 sm:text-6xl">📊</div>
      <h3 className="mb-2 text-lg font-bold sm:text-xl text-primary-900">{t("empty.title")}</h3>
      <p className="max-w-xs mx-auto text-sm sm:max-w-md sm:text-base text-primary-500">{message}</p>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="px-1 space-y-4 sm:space-y-6">
    <Skeleton className="w-40 sm:w-64 h-7 sm:h-8" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 sm:h-32" />
      ))}
    </div>
    <Skeleton className="h-48 sm:h-72" />
    <Skeleton className="h-48 sm:h-96" />
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${active ? "bg-primary-900 text-white shadow-md" : "bg-neutral text-primary-600 hover:bg-neutral-200"}`}
  >
    {children}
  </button>
);

export const Reports: React.FC = () => {
  const t = useTranslations("reportsPage");
  const { format } = useCurrency();

  const now = React.useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = React.useState<ReportTab>("monthly");
  const [selectedMonth, setSelectedMonth] = React.useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = React.useState(now.getFullYear());
  const [customStart, setCustomStart] = React.useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [customEnd, setCustomEnd] = React.useState(now.toISOString().split("T")[0]);

  const monthOptions = React.useMemo(
    () => [
      { value: "1", label: t("months.january") },
      { value: "2", label: t("months.february") },
      { value: "3", label: t("months.march") },
      { value: "4", label: t("months.april") },
      { value: "5", label: t("months.may") },
      { value: "6", label: t("months.june") },
      { value: "7", label: t("months.july") },
      { value: "8", label: t("months.august") },
      { value: "9", label: t("months.september") },
      { value: "10", label: t("months.october") },
      { value: "11", label: t("months.november") },
      { value: "12", label: t("months.december") },
    ],
    [t],
  );

  const { data: monthlyResp, isLoading: monthlyLoading } = useQuery<ApiResponse<MonthlyReport>>({
    queryKey: ["reports", "monthly", selectedMonth, selectedYear],
    queryFn: () => apiClient.get("/reports/monthly", { params: { month: selectedMonth, year: selectedYear } }),
    enabled: activeTab === "monthly",
  });

  const { data: yearlyResp, isLoading: yearlyLoading } = useQuery<ApiResponse<YearlyReport>>({
    queryKey: ["reports", "yearly", selectedYear],
    queryFn: () => apiClient.get("/reports/yearly", { params: { year: selectedYear } }),
    enabled: activeTab === "yearly",
  });

  const {
    data: customResp,
    isPending: customLoading,
    mutate: runCustomReport,
  } = useMutation<ApiResponse<CustomReport>, Error, { startDate: string; endDate: string }>({
    mutationFn: (body) => apiClient.post("/reports/custom", body),
  });

  const isLoading = (activeTab === "monthly" && monthlyLoading) || (activeTab === "yearly" && yearlyLoading);

  const monthly = monthlyResp?.data;
  const yearly = yearlyResp?.data;
  const custom = customResp?.data;

  const selectedMonthName = React.useMemo(() => monthOptions.find((m) => m.value === selectedMonth.toString())?.label ?? "", [selectedMonth, monthOptions]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl text-primary-900">{t("title")}</h1>
          <p className="mt-0.5 sm:mt-1 text-sm sm:text-base text-primary-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-primary-500">
          <span className="px-2.5 sm:px-3 py-1 font-medium rounded-full bg-primary-100">
            {activeTab === "monthly" ? `📅 ${selectedMonthName} ${selectedYear}` : activeTab === "yearly" ? `📆 ${selectedYear}` : `📊 ${customStart} → ${customEnd}`}
          </span>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-neutral rounded-2xl w-fit">
        <TabButton active={activeTab === "monthly"} onClick={() => setActiveTab("monthly")}>
          📅 {t("tabs.monthly")}
        </TabButton>
        <TabButton active={activeTab === "yearly"} onClick={() => setActiveTab("yearly")}>
          📆 {t("tabs.yearly")}
        </TabButton>
        <TabButton active={activeTab === "custom"} onClick={() => setActiveTab("custom")}>
          🔧 {t("tabs.custom")}
        </TabButton>
      </div>

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          {activeTab === "monthly" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Select label={t("filter.month")} options={monthOptions} value={selectedMonth.toString()} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} />
              <Select label={t("filter.year")} options={YEAR_OPTIONS} value={selectedYear.toString()} onChange={(e) => setSelectedYear(parseInt(e.target.value))} />
            </div>
          )}

          {activeTab === "yearly" && (
            <div className="max-w-xs">
              <Select label={t("filter.year")} options={YEAR_OPTIONS} value={selectedYear.toString()} onChange={(e) => setSelectedYear(parseInt(e.target.value))} />
            </div>
          )}

          {activeTab === "custom" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <Input type="date" label={t("custom.startDate")} value={customStart} onChange={(e) => setCustomStart(e.target.value)} max={customEnd} />
              <Input type="date" label={t("custom.endDate")} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} min={customStart} max={now.toISOString().split("T")[0]} />
              <Button variant="primary" className="w-full sm:w-auto shrink-0" isLoading={customLoading} onClick={() => runCustomReport({ startDate: customStart, endDate: customEnd })}>
                🔍 {t("custom.generate")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {activeTab === "monthly" && monthly && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            <StatCard label={t("stats.totalIncome")} value={format(monthly.summary.income)} icon="💰" color="green" />
            <StatCard label={t("stats.totalExpense")} value={format(monthly.summary.expense)} icon="💳" color="red" />
            <StatCard label={t("stats.transfers")} value={format(monthly.summary.transfer)} icon="🔄" color="sky" subtitle={`${monthly.summary.counts.transfer} ${t("stats.txn")}`} />
            <StatCard
              label={t("stats.savingsRate")}
              value={`${(monthly.summary.savingsRate ?? 0).toFixed(1)}%`}
              icon="🎯"
              color="primary"
              subtitle={monthly.summary.savingsRate >= 20 ? t("stats.greatJob") : t("stats.keepImproving")}
            />
          </div>

          <Card className={`border ${monthly.summary.balance >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <CardContent className="pt-4 pb-4 sm:pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs tracking-wide uppercase sm:text-sm text-primary-500">{t("stats.netBalance")}</p>
                  <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${monthly.summary.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {monthly.summary.balance >= 0 ? "+" : ""}
                    {format(monthly.summary.balance)}
                  </p>
                </div>
                <div className="flex gap-3 text-xs sm:gap-6 sm:text-sm">
                  <div>
                    <p className="text-primary-400">{t("stats.dailyAvgExpense")}</p>
                    <p className="font-semibold text-primary-900 tabular-nums">{format(monthly.summary.avgDailyExpense)}</p>
                  </div>
                  <div>
                    <p className="text-primary-400">{t("stats.largestTransaction")}</p>
                    <p className="font-semibold text-primary-900 tabular-nums">{format(monthly.summary.largestTransaction)}</p>
                  </div>
                  <div>
                    <p className="text-primary-400">{t("stats.totalTransactions")}</p>
                    <p className="font-semibold text-primary-900">{monthly.summary.counts.total}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {monthly.spendingTrend.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">📈 {t("charts.dailySpending")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthly.spendingTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradExpenseMonthly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(8)} />
                    <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000).toFixed(0)}K`} />
                    <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                    <Area type="monotone" dataKey="amount" name={t("expense")} stroke={CHART_COLORS.expense} strokeWidth={2} fill="url(#gradExpenseMonthly)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {monthly.transferSummary && <TransferStrip summary={monthly.transferSummary} />}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">📈 {t("topCategories")}</CardTitle>
                <Badge variant="default">
                  {monthly.topCategories?.length ?? 0} {t("categoriesCount")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!monthly.topCategories?.length ? (
                <EmptyState message={t("empty.monthly")} />
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {monthly.topCategories.map((cat, i) => (
                    <CategoryBar key={i} category={cat} totalExpense={monthly.summary.expense} rank={i + 1} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard label={t("stats.transactionCount")} value={monthly.summary.counts.total} icon="🔢" />
            <StatCard label={t("stats.dailyAvgExpense")} value={format(monthly.summary.avgDailyExpense)} icon="📅" />
            <StatCard label={t("stats.largestTransaction")} value={format(monthly.summary.largestTransaction)} icon="💎" />
          </div>
        </>
      )}

      {activeTab === "yearly" && yearly && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            <StatCard label={t("stats.totalIncome")} value={format(yearly.summary.totalIncome)} icon="💰" color="green" />
            <StatCard label={t("stats.totalExpense")} value={format(yearly.summary.totalExpense)} icon="💳" color="red" />
            <StatCard label={t("stats.totalTransfers")} value={format(yearly.summary.totalTransfer)} icon="🔄" color="sky" subtitle={`${yearly.summary.counts.transfer} ${t("stats.txn")}`} />
            <StatCard
              label={t("stats.savingsRate")}
              value={`${(yearly.summary.savingsRate ?? 0).toFixed(1)}%`}
              icon="🎯"
              color="primary"
              subtitle={yearly.summary.savingsRate >= 20 ? t("stats.excellent") : t("stats.roomToImprove")}
            />
          </div>

          {(yearly.summary.bestMonth || yearly.summary.worstMonth) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {yearly.summary.bestMonth && (
                <Card className="border bg-emerald-50 border-emerald-100">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl">🏆</span>
                      <div>
                        <p className="text-xs font-medium uppercase text-emerald-600">{t("yearly.bestMonth")}</p>
                        <p className="text-lg font-bold sm:text-xl text-emerald-700">{yearly.summary.bestMonth.month}</p>
                        <p className="text-sm text-emerald-600 tabular-nums">+{format(yearly.summary.bestMonth.balance)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {yearly.summary.worstMonth && (
                <Card className="border bg-rose-50 border-rose-100">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl">📉</span>
                      <div>
                        <p className="text-xs font-medium uppercase text-rose-600">{t("yearly.worstMonth")}</p>
                        <p className="text-lg font-bold sm:text-xl text-rose-700">{yearly.summary.worstMonth.month}</p>
                        <p className="text-sm text-rose-600 tabular-nums">{format(yearly.summary.worstMonth.balance)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">📊 {t("charts.monthlyBreakdown")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yearly.monthlyBreakdown} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                  <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="income" name={t("income")} fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={t("expense")} fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="transfer" name={t("transfer")} fill={CHART_COLORS.transfer} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {yearly.transferSummary && <TransferStrip summary={yearly.transferSummary} />}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">📈 {t("topCategories")}</CardTitle>
                <Badge variant="default">
                  {yearly.topCategories?.length ?? 0} {t("categoriesCount")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!yearly.topCategories?.length ? (
                <EmptyState message={t("empty.yearly")} />
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {yearly.topCategories.map((cat, i) => (
                    <CategoryBar key={i} category={cat} totalExpense={yearly.summary.totalExpense} rank={i + 1} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">📆 {t("monthlyBreakdown")}</CardTitle>
                <Badge variant="default">
                  {yearly.monthlyBreakdown?.length ?? 0} {t("monthsCount")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!yearly.monthlyBreakdown?.length ? (
                <EmptyState message={t("empty.breakdown")} />
              ) : (
                <div className="space-y-1 sm:space-y-2">
                  {yearly.monthlyBreakdown.map((m, i) => (
                    <MonthBreakdown key={i} month={m} index={i} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard label={t("stats.totalTransactions")} value={yearly.summary.counts.total} icon="🔢" />
            <StatCard label={t("stats.avgMonthlyIncome")} value={format(yearly.summary.avgMonthlyIncome)} icon="💰" />
            <StatCard label={t("stats.avgMonthlyExpense")} value={format(yearly.summary.avgMonthlyExpense)} icon="💳" />
          </div>
        </>
      )}

      {activeTab === "custom" && (
        <>
          {!custom && !customLoading && (
            <Card>
              <CardContent className="pt-6">
                <EmptyState message={t("custom.empty")} />
              </CardContent>
            </Card>
          )}

          {customLoading && <LoadingSkeleton />}

          {custom && !customLoading && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                <StatCard label={t("stats.totalIncome")} value={format(custom.summary.income)} icon="💰" color="green" subtitle={`${custom.summary.counts.income} ${t("stats.txn")}`} />
                <StatCard label={t("stats.totalExpense")} value={format(custom.summary.expense)} icon="💳" color="red" subtitle={`${custom.summary.counts.expense} ${t("stats.txn")}`} />
                <StatCard label={t("stats.transfers")} value={format(custom.summary.transfer)} icon="🔄" color="sky" subtitle={`${custom.summary.counts.transfer} ${t("stats.txn")}`} />
                <StatCard
                  label={t("stats.savingsRate")}
                  value={`${(custom.summary.savingsRate ?? 0).toFixed(1)}%`}
                  icon="🎯"
                  color="primary"
                  subtitle={`${t("stats.balance")}: ${format(custom.summary.balance)}`}
                />
              </div>

              {custom.dailyTrend.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">📈 {t("charts.dailyTrend")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={custom.dailyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          {(["income", "expense", "transfer"] as const).map((k) => (
                            <linearGradient key={k} id={`grad_${k}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CHART_COLORS[k]} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={CHART_COLORS[k]} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000).toFixed(0)}K`} />
                        <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Area type="monotone" dataKey="income" name={t("income")} stroke={CHART_COLORS.income} strokeWidth={2} fill="url(#grad_income)" dot={false} activeDot={{ r: 3 }} />
                        <Area type="monotone" dataKey="expense" name={t("expense")} stroke={CHART_COLORS.expense} strokeWidth={2} fill="url(#grad_expense)" dot={false} activeDot={{ r: 3 }} />
                        <Area
                          type="monotone"
                          dataKey="transfer"
                          name={t("transfer")}
                          stroke={CHART_COLORS.transfer}
                          strokeWidth={2}
                          fill="url(#grad_transfer)"
                          dot={false}
                          activeDot={{ r: 3 }}
                          strokeDasharray="4 2"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {custom.transferSummary && <TransferStrip summary={custom.transferSummary} />}

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">📈 {t("custom.categoryBreakdown")}</CardTitle>
                    <Badge variant="default">
                      {custom.categoryBreakdown?.length ?? 0} {t("categoriesCount")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {!custom.categoryBreakdown?.length ? (
                    <EmptyState message={t("custom.emptyCategoryBreakdown")} />
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {custom.categoryBreakdown.map((cat, i) => (
                        <CategoryBar key={i} category={{ name: cat.name, total: cat.expense, icon: cat.icon, color: cat.color }} totalExpense={custom.summary.expense} rank={i + 1} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">🏦 {t("custom.accountBreakdown")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 sm:space-y-3">
                    {custom.accountBreakdown.map((acc, i) => (
                      <div key={i} className="flex flex-col gap-2 p-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4 rounded-xl bg-neutral hover:bg-neutral-100 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-lg sm:text-xl">{acc.icon ?? "🏦"}</span>
                          <div>
                            <p className="text-sm font-semibold sm:text-base text-primary-900">{acc.name}</p>
                            <Badge variant="default" className="mt-0.5">
                              {acc.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 text-xs sm:flex sm:gap-4 gap-x-4 gap-y-1 sm:text-sm">
                          <div className="text-center sm:text-right">
                            <p className="font-bold text-emerald-600 tabular-nums">+{format(acc.income)}</p>
                            <p className="text-primary-400">{t("custom.account.in")}</p>
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="font-bold text-rose-600 tabular-nums">-{format(acc.expense)}</p>
                            <p className="text-primary-400">{t("custom.account.out")}</p>
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="font-bold text-amber-600 tabular-nums">-{format(acc.transferOut)}</p>
                            <p className="text-primary-400">{t("custom.account.sent")}</p>
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="font-bold text-sky-600 tabular-nums">+{format(acc.transferIn)}</p>
                            <p className="text-primary-400">{t("custom.account.received")}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <StatCard label={t("stats.totalTransactions")} value={custom.summary.counts.total} icon="🔢" />
                <StatCard label={t("stats.dailyAvgExpense")} value={format(custom.summary.avgDailyExpense)} icon="📅" />
                <StatCard label={t("stats.netBalance")} value={format(custom.summary.balance)} icon="💎" color={custom.summary.balance >= 0 ? "green" : "red"} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

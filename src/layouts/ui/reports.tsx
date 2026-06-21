"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { apiClient } from "@/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrency } from "@/providers";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, Select, Skeleton, Badge, Input, Button } from "@/components";
import type { ApiResponse, MonthlyReport, YearlyReport, CustomReport } from "@/types";

type ReportTab = "monthly" | "yearly" | "custom";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: "green" | "red" | "teal" | "primary";
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

const YEAR_OPTIONS = ["2025", "2026", "2027", "2028", "2029", "2030"].map((y) => ({ value: y, label: y }));

const CHART_COLORS = {
  income: "#5F9598",
  expense: "#1D546D",
  transfer: "#061E29",
  grid: "#c5dae3",
  muted: "#74a6bc",
};

const COLOR_CONFIG = {
  green: {
    card: "from-secondary-50 to-white border-secondary-100 dark:from-secondary-900/10 dark:to-primary-200 dark:border-secondary-800/20",
    text: "text-secondary-400 dark:text-secondary-400",
    bg: "bg-secondary-50 dark:bg-secondary-900/10",
    border: "border-secondary-100 dark:border-secondary-800/20",
  },
  red: {
    card: "from-rose-50 to-white border-rose-100 dark:from-rose-950/20 dark:to-primary-200 dark:border-rose-900/30",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/20",
    border: "border-rose-100 dark:border-rose-900/30",
  },
  teal: {
    card: "from-primary-50 to-white border-primary-100 dark:from-primary-100/20 dark:to-primary-200 dark:border-primary-300",
    text: "text-primary-500 dark:text-primary-700",
    bg: "bg-primary-50 dark:bg-primary-100/20",
    border: "border-primary-100 dark:border-primary-300",
  },
  primary: {
    card: "from-primary-100 to-white border-primary-200 dark:from-primary-200/20 dark:to-primary-200 dark:border-primary-400",
    text: "text-primary-900 dark:text-primary-900",
    bg: "bg-primary-100/50 dark:bg-primary-200/20",
    border: "border-primary-200 dark:border-primary-400",
  },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = "primary", subtitle }) => {
  const cfg = COLOR_CONFIG[color];
  return (
    <Card variant="elevated" className={`bg-linear-to-br ${cfg.bg} border ${cfg.border} transition-all hover:shadow-lg`}>
      <CardContent className="pt-4 pb-4 sm:pt-6">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-wide text-primary-500 dark:text-primary-700">{label}</p>
          <span className="text-xl sm:text-2xl">{icon}</span>
        </div>
        <p className={`text-xl sm:text-2xl md:text-3xl font-bold tabular-nums ${cfg.text}`}>{value}</p>
        {subtitle && <p className="text-xs mt-1 text-primary-400 dark:text-primary-600">{subtitle}</p>}
      </CardContent>
    </Card>
  );
};

const CategoryBar: React.FC<CategoryBarProps> = ({ category, totalExpense, rank }) => {
  const { format } = useCurrency();
  const percentage = totalExpense > 0 ? (category.total / totalExpense) * 100 : 0;
  const barColor = category.color && category.color !== "#gray" ? category.color : "#1D546D";

  return (
    <div className="p-3 transition-colors sm:p-4 rounded-xl bg-primary-50 dark:bg-primary-300 hover:bg-primary-100 dark:hover:bg-primary-400 group">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center flex-1 min-w-0 gap-2 sm:gap-3">
          <span className="w-5 text-xs font-bold text-primary-300 dark:text-primary-600 shrink-0">#{rank}</span>
          <span className="text-lg sm:text-2xl shrink-0">{category.icon ?? "📊"}</span>
          <span className="text-sm font-medium truncate sm:text-base text-primary-900 dark:text-primary-900">{category.name}</span>
        </div>
        <div className="ml-3 text-right shrink-0">
          <p className="text-sm font-bold sm:text-lg text-primary-600 dark:text-primary-700 tabular-nums">{format(category.total)}</p>
          <p className="text-xs text-primary-400 dark:text-primary-600">{percentage.toFixed(1)}%</p>
        </div>
      </div>
      <div className="w-full h-2 sm:h-2.5 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-400">
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
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-xl transition-colors gap-2 sm:gap-0 ${index % 2 === 0 ? "bg-primary-50 dark:bg-primary-300" : "bg-white dark:bg-primary-200"} hover:bg-primary-100 dark:hover:bg-primary-400`}
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-base sm:text-xl">📅</span>
        <span className="text-sm font-semibold sm:text-base text-primary-900 dark:text-primary-900 min-w-12">{month.month}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:gap-4 md:gap-6 sm:text-sm">
        <div className="text-center sm:text-right">
          <p className="font-bold text-secondary-400 dark:text-secondary-400 tabular-nums">+{format(month.income)}</p>
          <p className="text-primary-400 dark:text-primary-600">{t("income")}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="font-bold text-primary-600 dark:text-primary-700 tabular-nums">-{format(month.expense)}</p>
          <p className="text-primary-400 dark:text-primary-600">{t("expense")}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="font-bold text-primary-500 dark:text-primary-700 tabular-nums">⇄{format(month.transfer)}</p>
          <p className="text-primary-400 dark:text-primary-600">{t("transfer")}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className={`font-bold tabular-nums ${isPositive ? "text-primary-900 dark:text-primary-900" : "text-rose-600 dark:text-rose-400"}`}>
            {isPositive ? "+" : ""}
            {format(month.balance)}
          </p>
          <p className="text-primary-400 dark:text-primary-600">{t("balance")}</p>
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
    { label: t("transferSummary.totalMoved"), value: summary.totalMoved, icon: "🔄", color: "text-primary-500 dark:text-primary-700", raw: false },
    { label: t("transferSummary.totalReceived"), value: summary.totalReceived, icon: "📥", color: "text-secondary-400 dark:text-secondary-400", raw: false },
    { label: t("transferSummary.withdrawals"), value: summary.withdrawals, icon: "🏧", color: "text-amber-600 dark:text-amber-400", raw: false },
    { label: t("transferSummary.count"), value: summary.count, icon: "🔢", color: "text-primary-600 dark:text-primary-700", raw: true },
  ];

  return (
    <Card className="border bg-secondary-50 dark:bg-secondary-900/10 border-secondary-100 dark:border-secondary-800/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-secondary-500 dark:text-secondary-400">🔄 {t("transferSummary.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {items.map(({ label, value, icon, color, raw }) => (
            <div key={label} className="p-2 text-center shadow-sm sm:p-3 rounded-xl bg-white dark:bg-primary-200">
              <span className="text-xl sm:text-2xl">{icon}</span>
              <p className={`text-base sm:text-xl font-bold tabular-nums mt-1 ${color}`}>{raw ? value : format(value as number)}</p>
              <p className="text-xs text-primary-400 dark:text-primary-600 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ChartTooltip: React.FC<{ active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; formatter?: (v: number) => string }> = ({
  active,
  payload,
  label,
  formatter,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-primary-200 border border-primary-100 dark:border-primary-400 rounded-xl shadow-xl p-2.5 sm:p-3 text-xs sm:text-sm">
      <p className="font-semibold text-primary-700 dark:text-primary-800 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="capitalize text-primary-500 dark:text-primary-700">{p.name}:</span>
          <span className="font-semibold text-primary-900 dark:text-primary-900 tabular-nums">{formatter ? formatter(p.value) : p.value.toLocaleString()}</span>
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
      <h3 className="mb-2 text-lg font-bold sm:text-xl text-primary-900 dark:text-primary-900">{t("empty.title")}</h3>
      <p className="max-w-xs mx-auto text-sm sm:max-w-md sm:text-base text-primary-500 dark:text-primary-700">{message}</p>
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
    className={`px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
      active
        ? "bg-primary-500 dark:bg-secondary-400 text-white dark:text-primary-900 shadow-md"
        : "bg-primary-50 dark:bg-primary-300 text-primary-600 dark:text-primary-800 hover:bg-primary-100 dark:hover:bg-primary-400"
    }`}
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
          <h1 className="text-2xl font-bold sm:text-3xl text-primary-900 dark:text-primary-900">{t("title")}</h1>
          <p className="mt-0.5 sm:mt-1 text-sm sm:text-base text-primary-500 dark:text-primary-700">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-primary-500 dark:text-primary-700">
          <span className="px-2.5 sm:px-3 py-1 font-medium rounded-full bg-primary-100 dark:bg-primary-300 text-primary-700 dark:text-primary-800">
            {activeTab === "monthly" ? `📅 ${selectedMonthName} ${selectedYear}` : activeTab === "yearly" ? `📆 ${selectedYear}` : `📊 ${customStart} → ${customEnd}`}
          </span>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-primary-50 dark:bg-primary-300 rounded-2xl w-fit">
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

      <Card className="dark:bg-primary-200 dark:border-primary-400">
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
            <StatCard label={t("stats.transfers")} value={format(monthly.summary.transfer)} icon="🔄" color="teal" subtitle={`${monthly.summary.counts.transfer} ${t("stats.txn")}`} />
            <StatCard
              label={t("stats.savingsRate")}
              value={`${(monthly.summary.savingsRate ?? 0).toFixed(1)}%`}
              icon="🎯"
              color="primary"
              subtitle={monthly.summary.savingsRate >= 20 ? t("stats.greatJob") : t("stats.keepImproving")}
            />
          </div>

          <Card
            className={`border ${monthly.summary.balance >= 0 ? "border-secondary-200 dark:border-secondary-800/30 bg-secondary-50 dark:bg-secondary-900/10" : "border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20"}`}
          >
            <CardContent className="pt-4 pb-4 sm:pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs tracking-wide uppercase sm:text-sm text-primary-500 dark:text-primary-700">{t("stats.netBalance")}</p>
                  <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${monthly.summary.balance >= 0 ? "text-secondary-400 dark:text-secondary-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {monthly.summary.balance >= 0 ? "+" : ""}
                    {format(monthly.summary.balance)}
                  </p>
                </div>
                <div className="flex gap-3 text-xs sm:gap-6 sm:text-sm">
                  {[
                    { label: t("stats.dailyAvgExpense"), value: format(monthly.summary.avgDailyExpense) },
                    { label: t("stats.largestTransaction"), value: format(monthly.summary.largestTransaction) },
                    { label: t("stats.totalTransactions"), value: monthly.summary.counts.total },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-primary-400 dark:text-primary-600">{label}</p>
                      <p className="font-semibold text-primary-900 dark:text-primary-900 tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {monthly.spendingTrend.length > 0 && (
            <Card className="dark:bg-primary-200 dark:border-primary-400">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">📈 {t("charts.dailySpending")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthly.spendingTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradExpMonthly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(8)} />
                    <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000).toFixed(0)}K`} />
                    <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                    <Area type="monotone" dataKey="amount" name={t("expense")} stroke={CHART_COLORS.expense} strokeWidth={2} fill="url(#gradExpMonthly)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {monthly.transferSummary && <TransferStrip summary={monthly.transferSummary} />}

          <Card className="dark:bg-primary-200 dark:border-primary-400">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">📈 {t("topCategories")}</CardTitle>
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
            <StatCard label={t("stats.totalTransfers")} value={format(yearly.summary.totalTransfer)} icon="🔄" color="teal" subtitle={`${yearly.summary.counts.transfer} ${t("stats.txn")}`} />
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
                <Card className="border bg-secondary-50 dark:bg-secondary-900/10 border-secondary-100 dark:border-secondary-800/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl">🏆</span>
                      <div>
                        <p className="text-xs font-medium uppercase text-secondary-500 dark:text-secondary-400">{t("yearly.bestMonth")}</p>
                        <p className="text-lg font-bold sm:text-xl text-secondary-600 dark:text-secondary-400">{yearly.summary.bestMonth.month}</p>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400 tabular-nums">+{format(yearly.summary.bestMonth.balance)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {yearly.summary.worstMonth && (
                <Card className="border bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl">📉</span>
                      <div>
                        <p className="text-xs font-medium uppercase text-rose-600 dark:text-rose-400">{t("yearly.worstMonth")}</p>
                        <p className="text-lg font-bold sm:text-xl text-rose-700 dark:text-rose-400">{yearly.summary.worstMonth.month}</p>
                        <p className="text-sm text-rose-600 dark:text-rose-400 tabular-nums">{format(yearly.summary.worstMonth.balance)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card className="dark:bg-primary-200 dark:border-primary-400">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">📊 {t("charts.monthlyBreakdown")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yearly.monthlyBreakdown} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                  <ReTooltip content={<ChartTooltip formatter={(v) => format(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span className="capitalize text-primary-500 dark:text-primary-700">{value}</span>} />
                  <Bar dataKey="income" name={t("income")} fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={t("expense")} fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="transfer" name={t("transfer")} fill={CHART_COLORS.transfer} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {yearly.transferSummary && <TransferStrip summary={yearly.transferSummary} />}

          <Card className="dark:bg-primary-200 dark:border-primary-400">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">📈 {t("topCategories")}</CardTitle>
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

          <Card className="dark:bg-primary-200 dark:border-primary-400">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">📆 {t("monthlyBreakdown")}</CardTitle>
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
            <Card className="dark:bg-primary-200 dark:border-primary-400">
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
                <StatCard label={t("stats.transfers")} value={format(custom.summary.transfer)} icon="🔄" color="teal" subtitle={`${custom.summary.counts.transfer} ${t("stats.txn")}`} />
                <StatCard
                  label={t("stats.savingsRate")}
                  value={`${(custom.summary.savingsRate ?? 0).toFixed(1)}%`}
                  icon="🎯"
                  color="primary"
                  subtitle={`${t("stats.balance")}: ${format(custom.summary.balance)}`}
                />
              </div>

              {custom.dailyTrend.length > 0 && (
                <Card className="dark:bg-primary-200 dark:border-primary-400">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">📈 {t("charts.dailyTrend")}</CardTitle>
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
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span className="capitalize text-primary-500 dark:text-primary-700">{value}</span>} />
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

              <Card className="dark:bg-primary-200 dark:border-primary-400">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">📈 {t("custom.categoryBreakdown")}</CardTitle>
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

              <Card className="dark:bg-primary-200 dark:border-primary-400">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base dark:text-primary-900">🏦 {t("custom.accountBreakdown")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 sm:space-y-3">
                    {custom.accountBreakdown.map((acc, i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-2 p-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4 rounded-xl bg-primary-50 dark:bg-primary-300 hover:bg-primary-100 dark:hover:bg-primary-400 sm:gap-0"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-lg sm:text-xl">{acc.icon ?? "🏦"}</span>
                          <div>
                            <p className="text-sm font-semibold sm:text-base text-primary-900 dark:text-primary-900">{acc.name}</p>
                            <Badge variant="default" className="mt-0.5">
                              {acc.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 text-xs sm:flex sm:gap-4 gap-x-4 gap-y-1 sm:text-sm">
                          {[
                            { label: t("custom.account.in"), value: `+${format(acc.income)}`, color: "text-secondary-400 dark:text-secondary-400" },
                            { label: t("custom.account.out"), value: `-${format(acc.expense)}`, color: "text-primary-600 dark:text-primary-700" },
                            { label: t("custom.account.sent"), value: `-${format(acc.transferOut)}`, color: "text-amber-600 dark:text-amber-400" },
                            { label: t("custom.account.received"), value: `+${format(acc.transferIn)}`, color: "text-primary-500 dark:text-primary-700" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="text-center sm:text-right">
                              <p className={`font-bold tabular-nums ${color}`}>{value}</p>
                              <p className="text-primary-400 dark:text-primary-600">{label}</p>
                            </div>
                          ))}
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

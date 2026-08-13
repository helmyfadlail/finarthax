export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export type RecurrenceInterval = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";

export type RecurrenceStatus = "OVERDUE" | "DUE_TODAY" | "UPCOMING";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  avatarFileId: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSetting {
  id: string;
  key: string;
  value: string;
  icon: string;
  type: "boolean" | "string" | "number" | "object" | "array";
  category: "general" | "notifications" | "appearance" | "security" | "privacy" | "billing";
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string | string[] | number | boolean;
  type: string;
  category: string;
  label: string;
  description?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = "USER" | "SUPERADMIN";

export type AppSettingType = "string" | "number" | "boolean" | "json";

/**
 * An `app_settings` row as the superadmin screen sees it: the value stays the raw string it is
 * stored as, rather than the parsed shape `/api/settings` hands the rest of the app.
 */
export interface ManagedAppSetting {
  id: string;
  key: string;
  value: string;
  type: AppSettingType;
  category: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isPublic: boolean;
  /** Owned by the seed catalogue: retunable, but not deletable. */
  isCatalogue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettingAudit {
  id: string;
  key: string;
  action: "create" | "update" | "delete";
  previousValue: string | null;
  newValue: string | null;
  actorId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface ManagedAppSettingList {
  data: ManagedAppSetting[];
  categories: string[];
}

export interface AppSettingInput {
  key: string;
  value: string;
  type: AppSettingType;
  category: string;
  label: string;
  description?: string | null;
  sortOrder: number;
  isPublic: boolean;
}

export type AppSettingUpdate = Partial<Omit<AppSettingInput, "key">>;

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string | null;
  toAccountId?: string | null;
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  attachment?: string;
  isRecurring: boolean;
  recurrenceInterval?: RecurrenceInterval | null;
  recurrenceKey?: string | null;
  nextOccurrence?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceDismissedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  account: Account;
  toAccount?: Account;
  category: Category;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: "CASH" | "BANK" | "EWALLET" | "CREDIT_CARD" | "INVESTMENT";
  balance: number;
  creditLimit?: number;
  color?: string;
  icon?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon?: string;
  color?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  spent: number;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
  category: Category;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

export interface PublicAccount {
  id: string;
  name: string;
  icon?: string | null;
  type: Account["type"];
  isDefault: boolean;
  balance?: number;
  creditLimit?: number | null;
}

/**
 * A transaction as the public quick-entry page is allowed to see it: no ids beyond the ones an
 * action needs, no attachment, no audit fields.
 */
export interface PublicTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  date: string;
  isRecurring: boolean;
  recurrenceInterval: RecurrenceInterval | null;
  account: RecurrenceAccountRef | null;
  toAccount: RecurrenceAccountRef | null;
  category: RecurrenceCategoryRef | null;
}

export interface QuickTransactionResources {
  email: string;
  name: string;
  categories: Category[];
  accounts: PublicAccount[];
  showsBalances: boolean;
  /** The owner's `publicQuickActivity` preference: with it off, the two lists below are empty and the actions are refused. */
  showsActivity: boolean;
  recentTransactions: PublicTransaction[];
  /** Tracked series that are due, plus those falling inside the owner's lookahead window. */
  dueRecurring: ScheduledRecurrence[];
}

export interface QuickRecurringLogData {
  email: string;
  action: "log";
  transactionId: string;
  amount?: number;
  date?: string;
}

export interface QuickRecurringTrackData {
  email: string;
  action: "track";
  transactionId: string;
  interval: RecurrenceInterval;
  endDate?: string | null;
}

export type QuickRecurringActionData = QuickRecurringLogData | QuickRecurringTrackData;

export interface QuickTransactionData {
  email: string;
  accountId: string;
  categoryId?: string | null;
  toAccountId?: string | null;
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  attachment?: string;
  isRecurring?: boolean;
  recurrenceInterval?: RecurrenceInterval | null;
  recurrenceEndDate?: string | null;
}

export interface DetectedPattern {
  patternKey: string;
  transactionId: string;
  type: TransactionType;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string | null;
  interval: RecurrenceInterval;
  occurrences: number;
  averageAmount: number;
  lastAmount: number;
  lastDate: string;
  nextDate: string;
  confidence: number;
  monthlyEstimate: number;
  dismissed: boolean;
}

export interface RecurrenceAccountRef {
  id: string;
  name: string;
  icon: string | null;
  type: Account["type"];
}

export interface RecurrenceCategoryRef {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface ScheduledRecurrence {
  transactionId: string;
  recurrenceKey: string;
  type: TransactionType;
  description: string | null;
  amount: number;
  interval: RecurrenceInterval;
  status: RecurrenceStatus;
  nextOccurrence: string;
  lastDate: string;
  daysUntil: number;
  occurrences: number;
  monthlyEstimate: number;
  recurrenceEndDate: string | null;
  account: RecurrenceAccountRef;
  toAccount: RecurrenceAccountRef | null;
  category: RecurrenceCategoryRef | null;
}

export interface RecurringOverview {
  summary: {
    dueCount: number;
    upcomingCount: number;
    detectedCount: number;
    trackedCount: number;
    monthlyCommitted: number;
    monthlyPotential: number;
  };
  due: ScheduledRecurrence[];
  upcoming: ScheduledRecurrence[];
  detected: DetectedPattern[];
  dismissed: DetectedPattern[];
}

export interface RecurringFilter {
  lookaheadDays?: number;
  historyDays?: number;
  minOccurrences?: number;
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  type?: TransactionType | "";
  accountId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface TransactionSpecifyType {
  income: number;
  expense: number;
  transfer: number;
}

export interface DashboardSummary {
  currentMonth: TransactionSpecifyType & {
    balance: number;
    counts: {
      income: number;
      expense: number;
      transfer: number;
      total: number;
    };
  };
  previousMonth: TransactionSpecifyType & {
    balance: number;
  };
  changes: TransactionSpecifyType & {
    balance: number;
  };
  totalBalance: number;
  accounts: Account[];
  recentTransactions: Transaction[];
}

export interface DashboardCharts {
  monthlyData: (TransactionSpecifyType & { month: string })[];
  categoryData: { name: string; value: number; color: string }[];
  budgetProgress: { category: string; budget: number; spent: number; percentage: number }[];
  transferSummary: { totalMoved: number; totalReceived: number; withdrawals: number };
}

export interface TransactionCounts {
  income: number;
  expense: number;
  transfer: number;
  total: number;
}

export interface TransferSummary {
  totalMoved: number;
  totalReceived: number;
  withdrawals: number;
  count: number;
}

export interface TopCategory {
  name: string;
  icon?: string;
  color?: string;
  total: number;
}

export interface SpendingTrend {
  date: string;
  amount: number;
}

export interface DailyTrend {
  date: string;
  income: number;
  expense: number;
  transfer: number;
}

export interface MonthlyReport {
  summary: {
    income: number;
    expense: number;
    transfer: number;
    balance: number;
    savingsRate: number;
    avgDailyExpense: number;
    largestTransaction: number;
    transactionCount: number;
    counts: TransactionCounts;
  };
  topCategories: TopCategory[];
  spendingTrend: SpendingTrend[];
  transferSummary: TransferSummary;
  transactions: Transaction[];
}

export interface MonthlyBreakdown {
  month: string;
  income: number;
  expense: number;
  transfer: number;
  balance: number;
}

export interface YearlyReport {
  summary: {
    totalIncome: number;
    totalExpense: number;
    totalTransfer: number;
    yearlyBalance: number;
    avgMonthlyIncome: number;
    avgMonthlyExpense: number;
    avgMonthlyTransfer: number;
    savingsRate: number;
    transactionCount: number;
    counts: TransactionCounts;
    bestMonth: { month: string; balance: number } | null;
    worstMonth: { month: string; balance: number } | null;
  };
  monthlyBreakdown: MonthlyBreakdown[];
  topCategories: TopCategory[];
  transferSummary: TransferSummary;
}

export interface CustomCategoryBreakdown {
  name: string;
  icon?: string;
  color?: string;
  income: number;
  expense: number;
}

export interface CustomAccountBreakdown {
  name: string;
  icon?: string;
  type: string;
  income: number;
  expense: number;
  transferOut: number;
  transferIn: number;
}

export interface CustomReport {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    income: number;
    expense: number;
    transfer: number;
    balance: number;
    savingsRate: number;
    transactionCount: number;
    counts: TransactionCounts;
    avgDailyExpense: number;
  };
  categoryBreakdown: CustomCategoryBreakdown[];
  accountBreakdown: CustomAccountBreakdown[];
  dailyTrend: DailyTrend[];
  transferSummary: TransferSummary;
  transactions: Transaction[];
}

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

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

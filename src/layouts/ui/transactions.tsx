"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useTransactions, useCategories, useAccounts, useSearchPagination } from "@/hooks";
import { useCurrency } from "@/providers";
import { Card, CardContent, Button, Input, Select, Badge, Modal, Skeleton, useToast } from "@/components";
import type { Transaction, TransactionFilter, TransactionType, Account } from "@/types";
import { formattedDateTime } from "@/utils";

const FILTER_NAMES = ["type", "category", "startDate", "endDate", "account"] as const;
interface FormData {
  accountId: string;
  toAccountId: string;
  categoryId: string;
  amount: string;
  type: TransactionType;
  description: string;
  date: string;
}
interface SelectOption {
  value: string;
  label: string;
}
interface TransactionItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}
interface EmptyStateProps {
  onCreateClick: () => void;
}

const INITIAL_FORM_DATA: FormData = { accountId: "", toAccountId: "", categoryId: "", amount: "", type: "EXPENSE", description: "", date: new Date().toISOString().split("T")[0] };

const TYPE_CONFIG: Record<TransactionType, { color: string; bg: string; icon: string; prefix: string }> = {
  INCOME: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: "💰", prefix: "+" },
  EXPENSE: { color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30", icon: "💳", prefix: "-" },
  TRANSFER: { color: "text-secondary-400 dark:text-secondary-400", bg: "bg-secondary-100 dark:bg-secondary-900/20", icon: "🔄", prefix: "⇄" },
};

const isCreditCard = (account?: Account | null): boolean => account?.type === "CREDIT_CARD";

const getTransactionHint = (
  type: TransactionType,
  sourceAccount?: Account | null,
  destAccount?: Account | null,
  t?: (key: string, opts?: Record<string, unknown>) => string,
): { text: string; variant: "info" | "warning" | "error" } | null => {
  if (!t) return null;
  if (isCreditCard(sourceAccount)) {
    if (type === "INCOME") return { text: t("hints.creditCardNoIncome", { defaultValue: "⚠️ Income not allowed on credit card. Use a Transfer instead." }), variant: "error" };
    if (type === "EXPENSE") return { text: t("hints.creditCardExpense", { defaultValue: "💳 This will increase your credit card debt." }), variant: "warning" };
    if (type === "TRANSFER") return { text: t("hints.creditCardCashAdvance", { defaultValue: "🏧 Transferring FROM a credit card increases your debt." }), variant: "warning" };
  }
  if (type === "TRANSFER" && isCreditCard(destAccount)) return { text: t("hints.creditCardPayoff", { defaultValue: "✅ Transferring TO your credit card will reduce your debt." }), variant: "info" };
  if (type === "TRANSFER") return { text: t("hints.transfer", { defaultValue: "🔄 Transfer moves money between your own accounts." }), variant: "info" };
  return null;
};

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onDelete, isDeleting }) => {
  const t = useTranslations("transactionsPage");
  const { format } = useCurrency();
  const config = TYPE_CONFIG[transaction.type as TransactionType] ?? TYPE_CONFIG.EXPENSE;
  const isTransfer = transaction.type === "TRANSFER";
  const isCCExp = transaction.type === "EXPENSE" && transaction.account?.type === "CREDIT_CARD";
  const badgeVariant = transaction.type === "INCOME" ? "success" : transaction.type === "TRANSFER" ? "info" : "error";
  const badgeLabel = transaction.type === "INCOME" ? `${config.icon} ${t("income")}` : transaction.type === "TRANSFER" ? `${config.icon} ${t("transfer")}` : `${config.icon} ${t("expense")}`;

  return (
    <div className="flex items-center justify-between gap-2 p-3 transition-all rounded-lg group sm:p-4 sm:gap-4 bg-primary-50 hover:bg-primary-100 hover:shadow-md dark:bg-primary-200 dark:hover:bg-primary-300">
      <div className="flex items-center flex-1 min-w-0 gap-2 sm:gap-4">
        <div className={`flex items-center justify-center shrink-0 w-9 h-9 text-lg sm:w-12 sm:h-12 sm:text-2xl rounded-full transition-transform group-hover:scale-110 ${config.bg}`}>
          {isTransfer ? "🔄" : (transaction.category?.icon ?? "💰")}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate sm:text-base text-primary-900 dark:text-primary-900" title={transaction.description}>
            {transaction.description || t("noDescription")}
          </h4>
          <div className="flex flex-wrap items-center gap-1 mt-0.5 text-xs sm:gap-2 sm:mt-1 sm:text-sm text-primary-500 dark:text-primary-700">
            {!isTransfer && transaction.category && (
              <>
                <span className="flex items-center gap-1 truncate max-w-24 sm:max-w-none">
                  {transaction.category.icon} {transaction.category.name}
                </span>
                <span className="hidden sm:inline">•</span>
              </>
            )}
            <span className="flex items-center gap-1 truncate max-w-24 sm:max-w-none">
              {transaction.account?.icon} {transaction.account?.name}
              {isCCExp && <span className="ml-1 px-1 py-0.5 text-[10px] font-semibold rounded bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">debt</span>}
            </span>
            {isTransfer && transaction.toAccount && (
              <>
                <span>→</span>
                <span className="flex items-center gap-1 truncate max-w-20 sm:max-w-none">
                  {transaction.toAccount.icon} {transaction.toAccount.name}
                  {transaction.toAccount.type === "CREDIT_CARD" && (
                    <span className="ml-1 px-1 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">payoff</span>
                  )}
                </span>
              </>
            )}
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">📅 {formattedDateTime(transaction.date)}</span>
          </div>
          <p className="mt-0.5 text-xs text-primary-400 dark:text-primary-600 sm:hidden">📅 {formattedDateTime(transaction.date)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 sm:gap-4">
        <div className="text-right">
          <p className={`text-sm sm:text-lg lg:text-xl font-bold tabular-nums ${config.color}`}>
            {config.prefix} {format(transaction.amount)}
          </p>
          <Badge variant={badgeVariant} className="hidden mt-1 sm:inline-flex">
            {badgeLabel}
          </Badge>
        </div>
        <Button variant="danger" size="sm" onClick={() => onDelete(transaction.id)} disabled={isDeleting} aria-label={t("deleteButton")} className="px-2 sm:px-3">
          🗑️
        </Button>
      </div>
    </div>
  );
};

const EmptyState: React.FC<EmptyStateProps> = ({ onCreateClick }) => {
  const t = useTranslations("transactionsPage");
  return (
    <div className="py-10 text-center sm:py-16">
      <div className="mb-3 text-4xl sm:mb-4 sm:text-6xl">📝</div>
      <h3 className="mb-1.5 text-lg font-bold sm:mb-2 sm:text-xl text-primary-900 dark:text-primary-900">{t("empty.title")}</h3>
      <p className="max-w-xs mx-auto mb-5 text-sm sm:max-w-md sm:mb-6 text-primary-500 dark:text-primary-700">{t("empty.description")}</p>
      <Button variant="primary" onClick={onCreateClick} size="md" className="w-full sm:w-auto">
        + {t("empty.action")}
      </Button>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 sm:space-y-6">
    <Skeleton className="w-40 h-7 sm:w-64 sm:h-8" />
    <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 sm:h-24" />
      ))}
    </div>
    <div className="space-y-3 sm:space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 sm:h-24" />
      ))}
    </div>
  </div>
);

export const Transactions: React.FC = () => {
  const t = useTranslations("transactionsPage");
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { format } = useCurrency();
  const { addToast } = useToast();
  const { createTransaction, isCreating } = useTransactions();

  const {
    searchQuery,
    inputValue,
    setInputValue,
    currentPage,
    handlePageChange,
    filters: { type: selectedType, category: selectedCategory, startDate: selectedStartDate, endDate: selectedEndDate, account: selectedAccount },
    handleFilterChange,
    resetFilters,
  } = useSearchPagination({
    defaultPage: 1,
    debounceMs: 800,
    filterParamNames: FILTER_NAMES,
  });
  const handleTypeChange = (value: string) => handleFilterChange("type", value);
  const handleCategoryChange = (value: string) => handleFilterChange("category", value);
  const handleAccountChange = (value: string) => handleFilterChange("account", value);
  const handleStartDateChange = (value: string) => handleFilterChange("startDate", value);
  const handleEndDateChange = (value: string) => handleFilterChange("endDate", value);

  const { transactions, pagination, isLoading, deleteTransaction, isDeleting } = useTransactions({
    type: selectedType as TransactionFilter["type"],
    categoryId: selectedCategory,
    accountId: selectedAccount,
    startDate: selectedStartDate,
    endDate: selectedEndDate,
    search: searchQuery,
    page: currentPage,
    limit: 20,
  });

  const [formData, setFormData] = React.useState<FormData>(INITIAL_FORM_DATA);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const sourceAccount = React.useMemo(() => accounts.find((a) => a.id === formData.accountId) ?? null, [accounts, formData.accountId]);
  const destAccount = React.useMemo(() => accounts.find((a) => a.id === formData.toAccountId) ?? null, [accounts, formData.toAccountId]);
  const isSourceCreditCard = isCreditCard(sourceAccount);

  const allowedTypes = React.useMemo<SelectOption[]>(() => {
    const base: SelectOption[] = [
      { value: "EXPENSE", label: `💳 ${t("expense")}` },
      { value: "INCOME", label: `💰 ${t("income")}` },
      { value: "TRANSFER", label: `🔄 ${t("transfer")}` },
    ];
    return isSourceCreditCard ? base.filter((o) => o.value !== "INCOME") : base;
  }, [isSourceCreditCard, t]);

  const contextHint = React.useMemo(
    () => getTransactionHint(formData.type, sourceAccount, destAccount, t as (key: string, opts?: Record<string, unknown>) => string),
    [formData.type, sourceAccount, destAccount, t],
  );
  const getFilteredCategories = React.useCallback((type: TransactionType) => (type === "TRANSFER" ? [] : categories.filter((c) => c.type === type)), [categories]);
  const getDefaultCategory = React.useCallback(
    (type: TransactionType) => {
      const filtered = getFilteredCategories(type);
      return filtered.find((c) => c.isDefault) ?? filtered[0] ?? null;
    },
    [getFilteredCategories],
  );
  const categoryOptions = React.useMemo<SelectOption[]>(() => getFilteredCategories(formData.type).map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })), [formData.type, getFilteredCategories]);
  const accountOptions = React.useMemo<SelectOption[]>(() => accounts.map((a) => ({ value: a.id, label: `${a.icon} ${a.name}` })), [accounts]);
  const toAccountOptions = React.useMemo<SelectOption[]>(
    () => accounts.filter((a) => a.id !== formData.accountId).map((a) => ({ value: a.id, label: `${a.icon} ${a.name}${a.type === "CREDIT_CARD" ? " 💳" : ""}` })),
    [accounts, formData.accountId],
  );
  const fromAccountLabel = React.useMemo(() => (formData.type === "TRANSFER" ? t("modal.fromAccount") : t("modal.account")), [formData.type, t]);

  const resetForm = React.useCallback(() => setFormData(INITIAL_FORM_DATA), []);
  const openModal = React.useCallback(() => {
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);
  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const handleChangeForm = React.useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        if (field === "type") {
          const newType = value as TransactionType;
          updated.toAccountId = "";
          updated.categoryId = newType === "TRANSFER" ? "" : (getDefaultCategory(newType)?.id ?? "");
        }
        if (field === "accountId") {
          const account = accounts.find((a) => a.id === value);
          if (account?.type === "CREDIT_CARD" && updated.type === "INCOME") {
            updated.type = "EXPENSE";
            updated.categoryId = getDefaultCategory("EXPENSE")?.id ?? "";
          }
          if (updated.toAccountId === value) updated.toAccountId = "";
        }
        return updated;
      });
    },
    [getDefaultCategory, accounts],
  );

  const handleSubmitForm = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        addToast({ message: t("validation.amount"), type: "error" });
        return;
      }
      if (!formData.accountId) {
        addToast({ message: t("validation.account"), type: "error" });
        return;
      }
      if (isSourceCreditCard && formData.type === "INCOME") {
        addToast({ message: t("validation.creditCardNoIncome", { defaultValue: "Income not allowed on credit card." }), type: "error" });
        return;
      }
      if (formData.type === "TRANSFER" && formData.toAccountId && formData.toAccountId === formData.accountId) {
        addToast({ message: t("validation.sameAccount"), type: "error" });
        return;
      }
      if (formData.type !== "TRANSFER" && !formData.categoryId) {
        addToast({ message: t("validation.category"), type: "error" });
        return;
      }
      if (!formData.description.trim()) {
        addToast({ message: t("validation.description"), type: "error" });
        return;
      }
      const payload =
        formData.type === "TRANSFER"
          ? {
              type: formData.type,
              accountId: formData.accountId,
              toAccountId: formData.toAccountId || undefined,
              amount: parseFloat(formData.amount),
              description: formData.description.trim(),
              date: new Date(formData.date).toISOString(),
            }
          : {
              type: formData.type,
              accountId: formData.accountId,
              categoryId: formData.categoryId,
              amount: parseFloat(formData.amount),
              description: formData.description.trim(),
              date: new Date(formData.date).toISOString(),
            };
      createTransaction(payload, {
        onSuccess: () => {
          addToast({ message: t("success.created"), type: "success" });
          closeModal();
        },
        onError: (error: Error) => {
          addToast({ message: error.message || t("error.create"), type: "error" });
        },
      });
    },
    [formData, createTransaction, addToast, closeModal, t, isSourceCreditCard],
  );

  const handleDeleteClick = React.useCallback((id: string) => setDeleteId(id), []);
  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteId) return;
    deleteTransaction(deleteId, {
      onSuccess: () => {
        addToast({ message: t("success.deleted"), type: "success" });
        setDeleteId(null);
      },
      onError: (error: Error) => {
        addToast({ message: error.message || t("error.delete"), type: "error" });
        setDeleteId(null);
      },
    });
  }, [deleteId, deleteTransaction, addToast, t]);

  const hasActiveFilters = React.useMemo(
    () => selectedType || selectedCategory || selectedAccount || selectedStartDate || selectedEndDate || searchQuery,
    [selectedType, selectedCategory, selectedAccount, selectedStartDate, selectedEndDate, searchQuery],
  );
  const previewConfig = TYPE_CONFIG[formData.type];
  const previewSubtitle = React.useMemo(() => {
    if (formData.type === "TRANSFER") {
      const from = accounts.find((a) => a.id === formData.accountId)?.name ?? "—";
      const to = formData.toAccountId ? accounts.find((a) => a.id === formData.toAccountId)?.name : null;
      return to ? `${from} → ${to}` : from;
    }
    return categories.find((c) => c.id === formData.categoryId)?.name ?? t("modal.categoryLabel");
  }, [formData, accounts, categories, t]);
  const previewIcon = React.useMemo(() => {
    if (formData.type === "TRANSFER") return "🔄";
    return categories.find((c) => c.id === formData.categoryId)?.icon ?? "💰";
  }, [formData.type, formData.categoryId, categories]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900 dark:text-primary-900">{t("title")}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("subtitle")}</p>
        </div>
        <Button variant="primary" size="lg" onClick={openModal} className="w-full sm:w-auto">
          + {t("addButton")}
        </Button>
      </div>

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardContent className="pt-4 sm:pt-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium sm:text-sm text-primary-900 dark:text-primary-900">{t("filter.title")}</h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs sm:text-sm">
                  🔄 {t("filter.clear")}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              <Select
                label={t("filter.type")}
                options={[
                  { value: "", label: t("filter.allTypes") },
                  { value: "INCOME", label: `💰 ${t("income")}` },
                  { value: "EXPENSE", label: `💳 ${t("expense")}` },
                  { value: "TRANSFER", label: `🔄 ${t("transfer")}` },
                ]}
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
              />
              <Select
                label={t("filter.category")}
                options={[{ value: "", label: t("filter.allCategories") }, ...categoryOptions]}
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
              />
              <Select
                label={t("filter.account")}
                options={[{ value: "", label: t("filter.allAccounts") }, ...accountOptions]}
                value={selectedAccount}
                onChange={(e) => handleAccountChange(e.target.value)}
              />
              <Input label={t("filter.search")} placeholder={t("filter.searchPlaceholder")} value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
              <Input type="datetime-local" label={t("filter.startDate")} value={selectedStartDate} onChange={(e) => handleStartDateChange(e.target.value)} />
              <Input type="datetime-local" label={t("filter.endDate")} value={selectedEndDate} onChange={(e) => handleEndDateChange(e.target.value)} />
            </div>
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 pt-1 sm:gap-2 sm:pt-2">
                {selectedType && (
                  <Badge variant="default" className="text-xs">
                    {t("filter.type")}: {selectedType}
                  </Badge>
                )}
                {selectedCategory && (
                  <Badge variant="default" className="text-xs">
                    {t("filter.category")}: {categories.find((c) => c.id === selectedCategory)?.name}
                  </Badge>
                )}
                {selectedAccount && (
                  <Badge variant="default" className="text-xs">
                    {t("filter.account")}: {accounts.find((c) => c.id === selectedAccount)?.name}
                  </Badge>
                )}
                {selectedStartDate && (
                  <Badge variant="default" className="text-xs">
                    {t("filter.startDate")}: {formattedDateTime(selectedStartDate)}
                  </Badge>
                )}
                {selectedEndDate && (
                  <Badge variant="default" className="text-xs">
                    {t("filter.endDate")}: {formattedDateTime(selectedEndDate)}
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="default" className="text-xs">
                    {t("filter.search")}: &quot;{searchQuery}&quot;
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-sm font-bold sm:text-base lg:text-lg text-primary-900 dark:text-primary-900">
              {transactions.length > 0 ? `${t("listTitle")} (${transactions.length})` : t("listTitle")}
            </h2>
            {pagination && (
              <p className="text-xs sm:text-sm text-primary-500 dark:text-primary-700">
                {t("pagination.showing", { start: (pagination.page - 1) * 20 + 1, end: Math.min(pagination.page * 20, pagination.total), total: pagination.total })}
              </p>
            )}
          </div>
          {transactions.length === 0 ? (
            <EmptyState onCreateClick={openModal} />
          ) : (
            <>
              <div className="space-y-2 sm:space-y-3">
                {transactions.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} onDelete={handleDeleteClick} isDeleting={isDeleting} />
                ))}
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4 mt-4 border-t border-primary-100 dark:border-primary-400 sm:gap-3 sm:pt-6 sm:mt-6">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="text-xs sm:text-sm">
                    ← {t("pagination.previous")}
                  </Button>
                  <span className="px-1 text-xs sm:px-2 sm:text-sm text-primary-500 dark:text-primary-700">
                    {t("pagination.page")} <strong className="text-primary-900 dark:text-primary-900">{pagination.page}</strong> {t("pagination.of")}{" "}
                    <strong className="text-primary-900 dark:text-primary-900">{pagination.totalPages}</strong>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pagination.totalPages} className="text-xs sm:text-sm">
                    {t("pagination.next")} →
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={`➕ ${t("modal.addTitle")}`} size="lg">
        <div className="space-y-3 sm:space-y-4">
          <div className="p-2.5 sm:p-3 rounded-lg border bg-primary-50 dark:bg-primary-300 border-primary-100 dark:border-primary-400">
            <p className="text-xs font-medium sm:text-sm text-primary-700 dark:text-primary-800">💡 {t("modal.hint")}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <Select label={`${t("modal.type")} *`} options={allowedTypes} value={formData.type} onChange={(e) => handleChangeForm("type", e.target.value)} />
            <Input
              type="number"
              label={`${t("modal.amount")} *`}
              placeholder={t("modal.amountPlaceholder")}
              value={formData.amount}
              onChange={(e) => handleChangeForm("amount", e.target.value)}
              icon={<span className="text-primary-500 dark:text-primary-700">Rp</span>}
              min="1"
              step="1000"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <Select
              label={`${fromAccountLabel} *`}
              options={[{ value: "", label: t("modal.selected", { type: t("modal.account") }) }, ...accountOptions]}
              value={formData.accountId}
              onChange={(e) => handleChangeForm("accountId", e.target.value)}
              required
            />
            {formData.type === "TRANSFER" ? (
              <Select
                label={t("modal.toAccount")}
                options={[{ value: "", label: t("modal.toAccountOptional") }, ...toAccountOptions]}
                value={formData.toAccountId}
                onChange={(e) => handleChangeForm("toAccountId", e.target.value)}
              />
            ) : (
              <Select
                label={`${t("modal.category")} *`}
                options={[{ value: "", label: t("modal.selected", { type: t("modal.category") }) }, ...categoryOptions]}
                value={formData.categoryId}
                onChange={(e) => handleChangeForm("categoryId", e.target.value)}
                required
              />
            )}
          </div>
          {contextHint && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg border text-xs sm:text-sm ${
                contextHint.variant === "error"
                  ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400"
                  : contextHint.variant === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-secondary-50 dark:bg-secondary-900/10 border-secondary-100 dark:border-secondary-800/20 text-secondary-600 dark:text-secondary-400"
              }`}
            >
              <p>{contextHint.text}</p>
            </div>
          )}
          <Input
            type="datetime-local"
            label={`${t("modal.date")} *`}
            value={formData.date}
            onChange={(e) => handleChangeForm("date", e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            required
          />
          <Input
            type="text"
            label={`${t("modal.description")} *`}
            placeholder={t("modal.descriptionPlaceholder")}
            value={formData.description}
            onChange={(e) => handleChangeForm("description", e.target.value)}
            maxLength={200}
            required
          />
          {formData.amount && formData.description && (
            <div className="p-3 border rounded-lg sm:p-4 bg-primary-50 dark:bg-primary-300 border-primary-100 dark:border-primary-400">
              <p className="mb-2 text-xs font-medium sm:mb-3 sm:text-sm text-primary-600 dark:text-primary-700">{t("modal.preview")}:</p>
              <div className="flex items-center justify-between p-2.5 rounded-lg shadow-sm sm:p-3 bg-white dark:bg-primary-200">
                <div className="flex items-center min-w-0 gap-2 sm:gap-3">
                  <div className={`flex items-center justify-center shrink-0 w-8 h-8 text-lg sm:w-10 sm:h-10 sm:text-xl rounded-full ${previewConfig.bg}`}>{previewIcon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-primary-900 dark:text-primary-900">{formData.description}</p>
                    <p className="text-xs truncate text-primary-500 dark:text-primary-700">{previewSubtitle}</p>
                  </div>
                </div>
                <div className="ml-2 text-right shrink-0">
                  <p className={`text-sm sm:text-base font-bold tabular-nums ${previewConfig.color}`}>
                    {previewConfig.prefix} {format(formData.amount)}
                  </p>
                  <Badge variant={formData.type === "INCOME" ? "success" : formData.type === "TRANSFER" ? "info" : "error"} className="text-xs">
                    {formData.type}
                  </Badge>
                  {isSourceCreditCard && formData.type === "EXPENSE" && <p className="mt-0.5 text-xs text-rose-500 dark:text-rose-400">+debt</p>}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-primary-100 dark:border-primary-400 sm:gap-3 sm:pt-4">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={isCreating} className="text-xs sm:text-sm">
              {t("modal.cancel")}
            </Button>
            <Button onClick={handleSubmitForm} variant="primary" isLoading={isCreating} disabled={isSourceCreditCard && formData.type === "INCOME"} className="text-xs sm:text-sm">
              {t("modal.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t("deleteModal.title")} size="sm">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-start gap-2.5 p-3 border border-rose-200 dark:border-rose-900/30 rounded-lg sm:gap-3 sm:p-4 bg-rose-50 dark:bg-rose-950/20">
            <span className="text-xl sm:text-2xl shrink-0">⚠️</span>
            <div>
              <p className="mb-0.5 text-sm font-medium sm:mb-1 text-rose-900 dark:text-rose-300">{t("deleteModal.confirm")}</p>
              <p className="text-xs text-rose-700 dark:text-rose-400 sm:text-sm">{t("deleteModal.warning")}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={isDeleting} className="text-xs sm:text-sm">
              {t("deleteModal.cancel")}
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} isLoading={isDeleting} className="text-xs sm:text-sm">
              {t("deleteModal.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

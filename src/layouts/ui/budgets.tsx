"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useBudgets, useCategories, useSearchPagination } from "@/hooks";
import { useCurrency } from "@/providers";
import { Card, CardContent, Button, Input, Select, Modal, useToast } from "@/components";
import type { Budget, SelectOption } from "@/types";

const FILTER_NAMES = ["category"] as const;
interface BudgetStatus {
  type: "over" | "warning" | "safe";
  color: string;
  barColor: string;
  label: string;
}
interface FormData {
  categoryId: string;
  amount: string;
}
interface BudgetItemProps {
  budget: Budget;
  onEdit: (budgetId: string, newAmount: string) => void;
  onDelete: (budgetId: string) => void;
  isDeleting: boolean;
}
interface EmptyStateProps {
  onCreateClick: () => void;
}

const BudgetItem: React.FC<BudgetItemProps> = ({ budget, onEdit, onDelete, isDeleting }) => {
  const t = useTranslations("budgetsPage");
  const { format } = useCurrency();

  const [isEditing, setIsEditing] = React.useState(false);
  const [editAmount, setEditAmount] = React.useState(budget.amount.toString());

  const spent: number = Number(budget.spent);
  const amount: number = Number(budget.amount);
  const percentage: number = (spent / amount) * 100;
  const remaining: number = amount - spent;

  const status: BudgetStatus = React.useMemo(() => {
    if (percentage >= 100) return { type: "over", color: "text-rose-600 dark:text-rose-400", barColor: "bg-rose-500", label: t("status.overBudget") };
    if (percentage >= 80) return { type: "warning", color: "text-amber-600 dark:text-amber-400", barColor: "bg-amber-500", label: t("status.approachingLimit") };
    return { type: "safe", color: "text-secondary-400 dark:text-secondary-400", barColor: "bg-secondary-400", label: t("status.onTrack") };
  }, [percentage, t]);

  const handleSaveEdit = React.useCallback(() => {
    onEdit(budget.id, editAmount);
    setIsEditing(false);
  }, [budget.id, editAmount, onEdit]);
  const handleCancelEdit = React.useCallback(() => {
    setIsEditing(false);
    setEditAmount(budget.amount.toString());
  }, [budget.amount]);
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSaveEdit();
      if (e.key === "Escape") handleCancelEdit();
    },
    [handleSaveEdit, handleCancelEdit],
  );

  return (
    <Card variant="elevated" className="transition-shadow hover:shadow-lg dark:bg-primary-200 dark:border-primary-400">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start justify-between gap-3 mb-3 sm:gap-4 sm:mb-4">
          <div className="flex items-start flex-1 min-w-0 gap-2 sm:gap-3">
            <span className="text-2xl sm:text-3xl shrink-0" role="img" aria-label={budget.category.name}>
              {budget.category.icon}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="mb-1 text-base font-bold sm:text-lg text-primary-900 dark:text-primary-900">{budget.category.name}</h3>
              <div className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 sm:text-sm text-primary-500 dark:text-primary-700">
                <span className="font-medium tabular-nums">{format(spent)}</span>
                <span className="text-primary-300 dark:text-primary-600">/</span>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="py-1 text-xs w-28 sm:w-32 sm:text-sm"
                      icon={<span className="text-primary-500 dark:text-primary-700">Rp</span>}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                    <Button size="sm" variant="primary" onClick={handleSaveEdit} className="px-2 text-xs sm:px-3">
                      ✓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="px-2 text-xs sm:px-3">
                      ✕
                    </Button>
                  </div>
                ) : (
                  <button
                    className="px-1 font-medium rounded tabular-nums text-primary-700 dark:text-primary-800 hover:text-primary-900 dark:hover:text-primary-900 hover:underline focus:outline-none focus:ring-2 focus:ring-secondary-400"
                    onClick={() => setIsEditing(true)}
                    aria-label={t("editAmount")}
                  >
                    {format(amount)}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3 shrink-0">
            <div className="text-right">
              <p className={`text-lg sm:text-2xl font-bold tabular-nums ${status.color}`}>{percentage.toFixed(1)}%</p>
              <p className="text-xs text-primary-500 dark:text-primary-700 sm:mt-1 whitespace-nowrap">
                {remaining >= 0 ? `${format(remaining)} ${t("left")}` : `${format(Math.abs(remaining))} ${t("over")}`}
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => onDelete(budget.id)} disabled={isDeleting} aria-label={t("deleteButton")} className="px-2 sm:px-3">
              🗑️
            </Button>
          </div>
        </div>

        <div
          className="relative w-full h-3 mb-2 overflow-hidden rounded-full sm:h-4 bg-primary-100 dark:bg-primary-400"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={`h-full rounded-full transition-all duration-300 ${status.barColor}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
        </div>

        {status.type === "over" && (
          <div className="flex items-center gap-2 p-2 mt-2 border border-rose-200 dark:border-rose-900/30 rounded-lg sm:mt-3 bg-rose-50 dark:bg-rose-950/20">
            <span className="text-rose-600 dark:text-rose-400 shrink-0">⚠️</span>
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400 sm:text-sm">{t("overBudgetBy", { amount: format(Math.abs(remaining)) })}</p>
          </div>
        )}
        {status.type === "warning" && (
          <div className="flex items-center gap-2 p-2 mt-2 border border-amber-200 dark:border-amber-900/30 rounded-lg sm:mt-3 bg-amber-50 dark:bg-amber-950/20">
            <span className="text-amber-600 dark:text-amber-400 shrink-0">⚠️</span>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 sm:text-sm">
              {status.label} — {percentage.toFixed(0)}% {t("used")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const EmptyState: React.FC<EmptyStateProps> = ({ onCreateClick }) => {
  const t = useTranslations("budgetsPage");
  return (
    <Card className="dark:bg-primary-200 dark:border-primary-400">
      <CardContent className="pt-4 sm:pt-6">
        <div className="py-10 text-center sm:py-16">
          <div className="mb-3 text-4xl sm:mb-4 sm:text-6xl">📊</div>
          <h3 className="mb-1.5 text-lg font-bold sm:mb-2 sm:text-xl text-primary-900 dark:text-primary-900">{t("empty.title")}</h3>
          <p className="max-w-xs mx-auto mb-5 text-sm sm:max-w-md sm:mb-6 text-primary-500 dark:text-primary-700">{t("empty.description")}</p>
          <Button variant="primary" onClick={onCreateClick} size="md" className="w-full sm:w-auto">
            + {t("empty.action")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const Budgets: React.FC = () => {
  const t = useTranslations("budgetsPage");
  const now = React.useMemo(() => new Date(), []);

  const [selectedMonth, setSelectedMonth] = React.useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = React.useState(now.getFullYear());
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<FormData>({ categoryId: "", amount: "" });

  const {
    currentPage,
    handlePageChange,
    filters: { category: selectedCategory },
    handleFilterChange,
  } = useSearchPagination({ defaultPage: 1, filterParamNames: FILTER_NAMES });
  const handleCategoryChange = (value: string) => handleFilterChange("category", value);

  const { categories } = useCategories("EXPENSE");
  const { addToast } = useToast();

  const { budgets, pagination, createBudget, isCreating, updateBudget, deleteBudget, isDeleting } = useBudgets({
    month: selectedMonth,
    year: selectedYear,
    page: currentPage,
    limit: 10,
    categoryId: selectedCategory,
  });

  const categoryOptions: SelectOption[] = React.useMemo(() => categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })), [categories]);

  const monthOptions: SelectOption[] = React.useMemo(
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

  const yearOptions: SelectOption[] = [
    { value: "2024", label: "2024" },
    { value: "2025", label: "2025" },
    { value: "2026", label: "2026" },
    { value: "2027", label: "2027" },
    { value: "2028", label: "2028" },
  ];
  const selectedMonthLabel = React.useMemo(() => new Date(selectedYear, selectedMonth - 1).toLocaleString("default", { month: "long", year: "numeric" }), [selectedMonth, selectedYear]);

  const resetForm = React.useCallback((): void => setFormData({ categoryId: categories[0]?.id ?? "", amount: "" }), [categories]);
  const openModal = React.useCallback((): void => {
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);
  const closeModal = React.useCallback((): void => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const handleCreate = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      if (!formData.categoryId || !formData.amount) {
        addToast({ message: t("validation.required"), type: "error" });
        return;
      }
      const amount = parseFloat(formData.amount);
      if (amount <= 0) {
        addToast({ message: t("validation.amountGreaterThanZero"), type: "error" });
        return;
      }
      createBudget(
        { categoryId: formData.categoryId, amount, month: selectedMonth, year: selectedYear },
        {
          onSuccess: () => {
            addToast({ message: t("success.created"), type: "success" });
            closeModal();
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("error.create"), type: "error" });
          },
        },
      );
    },
    [formData, selectedMonth, selectedYear, createBudget, addToast, closeModal, t],
  );

  const handleUpdate = React.useCallback(
    (budgetId: string, newAmount: string): void => {
      const amount = parseFloat(newAmount);
      if (!newAmount || amount <= 0) {
        addToast({ message: t("validation.validAmount"), type: "error" });
        return;
      }
      updateBudget(
        { id: budgetId, data: { amount } },
        {
          onSuccess: () => {
            addToast({ message: t("success.updated"), type: "success" });
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("error.update"), type: "error" });
          },
        },
      );
    },
    [updateBudget, addToast, t],
  );

  const handleDeleteClick = React.useCallback((id: string): void => setDeleteId(id), []);
  const handleDeleteConfirm = React.useCallback((): void => {
    if (!deleteId) return;
    deleteBudget(deleteId, {
      onSuccess: () => {
        addToast({ message: t("success.deleted"), type: "success" });
        setDeleteId(null);
      },
      onError: (error: Error) => {
        addToast({ message: error.message || t("error.delete"), type: "error" });
      },
    });
  }, [deleteId, deleteBudget, addToast, t]);

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900 dark:text-primary-900">{t("title")}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("subtitle")}</p>
        </div>
        <Button variant="primary" size="lg" onClick={openModal} className="w-full sm:w-auto">
          + {t("setBudget")}
        </Button>
      </div>

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <Select label={t("filter.month")} options={monthOptions} value={selectedMonth.toString()} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} />
            <Select label={t("filter.year")} options={yearOptions} value={selectedYear.toString()} onChange={(e) => setSelectedYear(parseInt(e.target.value))} />
            <Select
              label={t("filter.category")}
              options={[{ value: "", label: t("filter.allCategories") }, ...categoryOptions]}
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2 sm:space-y-4">
        {budgets.length === 0 ? (
          <EmptyState onCreateClick={openModal} />
        ) : (
          <>
            {budgets.map((budget) => (
              <BudgetItem key={budget.id} budget={budget} onEdit={handleUpdate} onDelete={handleDeleteClick} isDeleting={isDeleting} />
            ))}

            {pagination && pagination.totalPages > 1 && (
              <Card className="dark:bg-primary-200 dark:border-primary-400">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
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
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={t("modal.title")} size="md">
        <div className="space-y-3 sm:space-y-4">
          <div className="p-2.5 border rounded-lg sm:p-3 bg-primary-50 dark:bg-primary-300 border-primary-100 dark:border-primary-400">
            <p className="text-xs font-medium sm:text-sm text-primary-700 dark:text-primary-800">
              📅 {t("modal.settingFor")} <strong>{selectedMonthLabel}</strong>
            </p>
          </div>
          <Select label={t("modal.category")} options={categoryOptions} value={formData.categoryId} onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))} required />
          <Input
            type="number"
            label={t("modal.amount")}
            placeholder={t("modal.amountPlaceholder")}
            value={formData.amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            icon={<span className="text-primary-500 dark:text-primary-700">Rp</span>}
            min="1"
            step="1000"
            required
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-primary-100 dark:border-primary-400 sm:gap-3 sm:pt-4">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={isCreating} className="text-xs sm:text-sm">
              {t("modal.cancel")}
            </Button>
            <Button onClick={handleCreate} variant="primary" isLoading={isCreating} className="text-xs sm:text-sm">
              {t("modal.save")}
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

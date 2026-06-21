"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, Button, Modal, Badge, useToast, Input, Select } from "@/components";
import { useCategories } from "@/hooks";
import type { Category } from "@/types";

interface FormData {
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string;
  color: string;
  isDefault: boolean;
}
interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  formData: FormData;
  onFormChange: (field: keyof FormData, value: string | boolean) => void;
  isSubmitting: boolean;
  isEditMode?: boolean;
  emojiSuggestions: string[];
  colorPalette: string[];
}
type FilterType = "ALL" | "INCOME" | "EXPENSE";
interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}
interface EmptyStateProps {
  type: FilterType;
  onCreateClick: () => void;
}

const COLOR_PALETTE = ["#5F9598", "#1D546D", "#061E29", "#9dc0cf", "#4d7e81", "#c6e0e1", "#144a5e", "#8abfc0", "#0c2644", "#74a6bc"];
const EMOJI_SUGGESTIONS = {
  INCOME: ["💰", "💵", "💸", "💳", "🏆", "📈", "💼", "🎁"],
  EXPENSE: ["🛒", "🍔", "🏠", "🚗", "⚡", "🎮", "👕", "📱", "✈️", "🏥", "📚", "🎬"],
};
const INITIAL_FORM: FormData = { name: "", type: "EXPENSE", icon: "📁", color: "#5F9598", isDefault: false };

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onEdit, onDelete }) => {
  const t = useTranslations("categoriesPage");
  const isIncome = category.type === "INCOME";

  return (
    <Card variant="elevated" className="transition-all duration-300 hover:shadow-xl group dark:bg-primary-200 dark:border-primary-400">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div
            className="flex items-center justify-center text-2xl transition-transform sm:text-3xl w-11 h-11 sm:w-14 sm:h-14 rounded-2xl group-hover:scale-110"
            style={{ backgroundColor: category.color + "20" }}
          >
            {category.icon}
          </div>
          {category.isDefault && (
            <Badge variant="info" className="text-xs">
              🔒 {t("default")}
            </Badge>
          )}
        </div>
        <h3 className="mb-1.5 text-base sm:text-lg font-bold truncate text-primary-900 dark:text-primary-900 sm:mb-2" title={category.name}>
          {category.name}
        </h3>
        <Badge variant={isIncome ? "success" : "error"} className="mb-3 text-xs sm:mb-4">
          {isIncome ? `💰 ${t("income")}` : `💳 ${t("expense")}`}
        </Badge>
        <div className="flex gap-2">
          {!category.isDefault ? (
            <>
              <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm" onClick={() => onEdit(category)}>
                ✏️ {t("editButton")}
              </Button>
              <Button variant="danger" size="sm" onClick={() => onDelete(category.id)} aria-label={t("deleteButton")} className="px-2 sm:px-3">
                🗑️
              </Button>
            </>
          ) : (
            <div className="flex-1 p-2 text-xs text-center rounded-lg text-primary-500 dark:text-primary-700 bg-primary-50 dark:bg-primary-300">{t("cannotModify")}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState: React.FC<EmptyStateProps> = ({ type, onCreateClick }) => {
  const t = useTranslations("categoriesPage");
  const message = React.useMemo(() => {
    switch (type) {
      case "INCOME":
        return { icon: "💰", title: t("empty.income.title"), description: t("empty.income.description") };
      case "EXPENSE":
        return { icon: "💳", title: t("empty.expense.title"), description: t("empty.expense.description") };
      default:
        return { icon: "📁", title: t("empty.all.title"), description: t("empty.all.description") };
    }
  }, [type, t]);

  return (
    <Card className="col-span-full dark:bg-primary-200 dark:border-primary-400">
      <CardContent className="pt-4 sm:pt-6">
        <div className="py-10 text-center sm:py-16">
          <div className="mb-3 text-4xl sm:mb-4 sm:text-6xl">{message.icon}</div>
          <h3 className="mb-1.5 text-lg font-bold sm:mb-2 sm:text-xl text-primary-900 dark:text-primary-900">{message.title}</h3>
          <p className="max-w-xs mx-auto mb-5 text-sm sm:max-w-md sm:mb-6 text-primary-500 dark:text-primary-700">{message.description}</p>
          <Button variant="primary" onClick={onCreateClick} size="md" className="w-full sm:w-auto">
            + {t("createButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({ isOpen, onClose, onSubmit, formData, onFormChange, isSubmitting, isEditMode = false, emojiSuggestions, colorPalette }) => {
  const t = useTranslations("categoriesPage");
  const title = isEditMode ? `✏️ ${t("modal.editTitle")}` : `➕ ${t("modal.addTitle")}`;
  const submitLabel = isEditMode ? `${t("modal.update")} ${t("modal.categoryLabel")}` : `${t("modal.create")} ${t("modal.categoryLabel")}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-3 sm:space-y-4">
        <div className="p-2.5 sm:p-3 border rounded-lg bg-primary-50 dark:bg-primary-300 border-primary-100 dark:border-primary-400">
          <p className="text-xs font-medium sm:text-sm text-primary-700 dark:text-primary-800">💡 {t("modal.hint")}</p>
        </div>

        <Input
          type="text"
          label={`${t("modal.name")} *`}
          placeholder={t("modal.namePlaceholder")}
          value={formData.name}
          onChange={(e) => onFormChange("name", e.target.value)}
          maxLength={50}
          required
        />

        <Select
          label={`${t("modal.type")} *`}
          options={[
            { value: "INCOME", label: `💰 ${t("income")}` },
            { value: "EXPENSE", label: `💳 ${t("expense")}` },
          ]}
          value={formData.type}
          onChange={(e) => onFormChange("type", e.target.value)}
          disabled={isEditMode}
        />

        <div className="space-y-1.5 sm:space-y-2">
          <Input label={`${t("modal.icon")} *`} type="text" placeholder="📁" value={formData.icon} onChange={(e) => onFormChange("icon", e.target.value)} maxLength={4} />
          <p className="text-xs text-primary-500 dark:text-primary-700">{t("modal.quickSelect")}:</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {emojiSuggestions.map((emoji) => (
              <button key={emoji} type="button" className="p-1 text-xl transition-transform sm:text-2xl hover:scale-125" onClick={() => onFormChange("icon", emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Input label={`${t("modal.color")} *`} type="color" value={formData.color} onChange={(e) => onFormChange("color", e.target.value)} />
          <div className="flex flex-wrap justify-center flex-1 gap-1.5 sm:gap-2">
            {colorPalette.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-transform hover:scale-110 ${formData.color === color ? "ring-2 ring-offset-2 ring-secondary-400" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => onFormChange("color", color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3 rounded-lg bg-primary-50 dark:bg-primary-300">
          <input
            type="checkbox"
            id="isDefaultCategory"
            checked={formData.isDefault}
            onChange={(e) => onFormChange("isDefault", e.target.checked)}
            className="w-4 h-4 rounded border-primary-300 text-primary-500 focus:ring-secondary-400 shrink-0"
          />
          <label htmlFor="isDefaultCategory" className="flex-1 text-xs font-medium sm:text-sm text-primary-900 dark:text-primary-900">
            {t("modal.setDefault")}
            <span className="block mt-0.5 text-xs text-primary-500 dark:text-primary-700">{t("modal.defaultHint")}</span>
          </label>
        </div>

        <div className="p-3 border rounded-lg sm:p-4 bg-primary-50 dark:bg-primary-300 border-primary-100 dark:border-primary-400">
          <p className="mb-2 text-xs font-medium sm:mb-3 sm:text-sm text-primary-600 dark:text-primary-700">{t("modal.preview")}:</p>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg shadow-sm sm:gap-3 sm:p-3 bg-white dark:bg-primary-200">
            <div className="flex items-center justify-center w-10 h-10 text-xl sm:w-12 sm:h-12 sm:text-2xl rounded-xl shrink-0" style={{ backgroundColor: formData.color + "20" }}>
              {formData.icon || "📁"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-primary-900 dark:text-primary-900">{formData.name || t("modal.categoryNameLabel")}</p>
              <div className="flex items-center gap-1.5 mt-1 sm:gap-2">
                <Badge variant={formData.type === "INCOME" ? "success" : "error"} className="text-xs">
                  {formData.type === "INCOME" ? `💰 ${t("income")}` : `💳 ${t("expense")}`}
                </Badge>
                {formData.isDefault && (
                  <Badge variant="info" className="text-xs">
                    {t("default")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-primary-100 dark:border-primary-400 sm:gap-3 sm:pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="text-xs sm:text-sm">
            {t("modal.cancel")}
          </Button>
          <Button onClick={onSubmit} variant="primary" isLoading={isSubmitting} className="text-xs sm:text-sm">
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const Categories: React.FC = () => {
  const t = useTranslations("categoriesPage");
  const { categories, createCategory, isCreating, updateCategory, deleteCategory, isDeleting } = useCategories();
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [filterType, setFilterType] = React.useState<FilterType>("ALL");
  const [formData, setFormData] = React.useState<FormData>(INITIAL_FORM);

  const { incomeCategories, expenseCategories, stats } = React.useMemo(() => {
    const filtered = categories.filter((cat) => filterType === "ALL" || cat.type === filterType);
    return {
      incomeCategories: filtered.filter((c) => c.type === "INCOME"),
      expenseCategories: filtered.filter((c) => c.type === "EXPENSE"),
      stats: {
        total: categories.length,
        income: categories.filter((c) => c.type === "INCOME").length,
        expense: categories.filter((c) => c.type === "EXPENSE").length,
        custom: categories.filter((c) => !c.isDefault).length,
      },
    };
  }, [categories, filterType]);

  const resetForm = React.useCallback((): void => setFormData(INITIAL_FORM), []);
  const openModal = React.useCallback((): void => {
    resetForm();
    setEditingCategory(null);
    setIsModalOpen(true);
  }, [resetForm]);
  const closeModal = React.useCallback((): void => {
    setIsModalOpen(false);
    setEditingCategory(null);
    resetForm();
  }, [resetForm]);

  const handleCreate = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      if (!formData.name.trim()) {
        addToast({ message: t("validation.required"), type: "error" });
        return;
      }
      if (formData.name.length > 50) {
        addToast({ message: t("validation.nameTooLong"), type: "error" });
        return;
      }
      if (categories.some((cat) => cat.name.toLowerCase() === formData.name.trim().toLowerCase() && cat.type === formData.type && cat.id !== editingCategory?.id)) {
        addToast({ message: t("validation.duplicate", { type: t(formData.type.toLowerCase()) }), type: "error" });
        return;
      }

      if (editingCategory) {
        updateCategory(
          { id: editingCategory.id, data: { ...formData, name: formData.name.trim() } },
          {
            onSuccess: () => {
              addToast({ message: t("success.updated"), type: "success" });
              closeModal();
            },
            onError: (error: Error) => {
              addToast({ message: error.message || t("error.update"), type: "error" });
            },
          },
        );
      } else {
        createCategory(
          { ...formData, name: formData.name.trim() },
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
      }
    },
    [formData, editingCategory, categories, createCategory, updateCategory, addToast, closeModal, t],
  );

  const handleEdit = React.useCallback((category: Category): void => {
    setEditingCategory(category);
    setFormData({ name: category.name, type: category.type, icon: category.icon || "📁", color: category.color || "#5F9598", isDefault: category.isDefault || false });
    setIsModalOpen(true);
  }, []);

  const handleDeleteClick = React.useCallback((id: string): void => setDeleteId(id), []);
  const handleDeleteConfirm = React.useCallback((): void => {
    if (!deleteId) return;
    deleteCategory(deleteId, {
      onSuccess: () => {
        addToast({ message: t("success.deleted"), type: "success" });
        setDeleteId(null);
      },
      onError: (error: Error) => {
        addToast({ message: error.message || t("error.delete"), type: "error" });
        setDeleteId(null);
      },
    });
  }, [deleteId, deleteCategory, addToast, t]);

  const handleFormChange = React.useCallback((field: keyof FormData, value: string | boolean): void => setFormData((prev) => ({ ...prev, [field]: value })), []);
  const handleFilterChange = React.useCallback((type: FilterType): void => setFilterType(type), []);

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

      {categories.length > 0 && (
        <Card className="dark:bg-primary-200 dark:border-primary-400">
          <CardContent className="pt-4 sm:pt-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {[
                { value: stats.total, label: t("stats.total"), color: "text-primary-900 dark:text-primary-900" },
                { value: stats.income, label: t("income"), color: "text-emerald-600 dark:text-emerald-400" },
                { value: stats.expense, label: t("expense"), color: "text-rose-600 dark:text-rose-400" },
                { value: stats.custom, label: t("stats.custom"), color: "text-primary-900 dark:text-primary-900" },
              ].map(({ value, label, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-xl font-bold sm:text-2xl tabular-nums ${color}`}>{value}</p>
                  <p className="mt-0.5 text-xs sm:mt-1 sm:text-sm text-primary-500 dark:text-primary-700">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Button variant={filterType === "ALL" ? "primary" : "outline"} onClick={() => handleFilterChange("ALL")} size="sm" className="text-xs sm:text-sm">
              📁 {t("filter.all")} ({stats.total})
            </Button>
            <Button variant={filterType === "INCOME" ? "primary" : "outline"} onClick={() => handleFilterChange("INCOME")} size="sm" className="text-xs sm:text-sm">
              💰 {t("income")} ({stats.income})
            </Button>
            <Button variant={filterType === "EXPENSE" ? "primary" : "outline"} onClick={() => handleFilterChange("EXPENSE")} size="sm" className="text-xs sm:text-sm">
              💳 {t("expense")} ({stats.expense})
            </Button>
          </div>
        </CardContent>
      </Card>

      {(filterType === "ALL" || filterType === "INCOME") && (
        <div>
          <h2 className="mb-3 text-base font-bold sm:mb-4 sm:text-xl text-primary-900 dark:text-primary-900">💰 {t("incomeCategories", { count: incomeCategories.length })}</h2>
          {incomeCategories.length === 0 ? (
            <EmptyState type="INCOME" onCreateClick={openModal} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {incomeCategories.map((category) => (
                <CategoryCard key={category.id} category={category} onEdit={handleEdit} onDelete={handleDeleteClick} />
              ))}
            </div>
          )}
        </div>
      )}

      {(filterType === "ALL" || filterType === "EXPENSE") && (
        <div>
          <h2 className="mb-3 text-base font-bold sm:mb-4 sm:text-xl text-primary-900 dark:text-primary-900">💳 {t("expenseCategories", { count: expenseCategories.length })}</h2>
          {expenseCategories.length === 0 ? (
            <EmptyState type="EXPENSE" onCreateClick={openModal} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {expenseCategories.map((category) => (
                <CategoryCard key={category.id} category={category} onEdit={handleEdit} onDelete={handleDeleteClick} />
              ))}
            </div>
          )}
        </div>
      )}

      <CategoryFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleCreate}
        formData={formData}
        onFormChange={handleFormChange}
        isSubmitting={isCreating}
        isEditMode={!!editingCategory}
        emojiSuggestions={EMOJI_SUGGESTIONS[formData.type]}
        colorPalette={COLOR_PALETTE}
      />

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

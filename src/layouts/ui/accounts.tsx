"use client";

import * as React from "react";

import { useTranslations } from "next-intl";

import { useAccounts } from "@/hooks";

import { Card, CardContent, Button, Input, Select, Modal, Badge, useToast, useCurrency } from "@/components";

import type { Account } from "@/types";

interface FormData {
  name: string;
  type: Account["type"];
  balance: string;
  creditLimit: string;
  color: string;
  icon: string;
  isDefault: boolean;
}

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
}

interface EmptyStateProps {
  onCreateClick: () => void;
}

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isSubmitting: boolean;
  hint: string;
  hintClass: string;
  submitLabel: string;
  formData: FormData;
  onFormChange: (field: keyof FormData, value: string | boolean) => void;
  isUpdateModal: boolean;
  accountTypeOptions: { value: string; label: string }[];
}

const ACCOUNT_TYPE_CONFIG: Record<Account["type"], { label: string; icon: string; color: string }> = {
  CASH: { label: "Cash", icon: "💵", color: "#10B981" },
  BANK: { label: "Bank Account", icon: "🏦", color: "#3B82F6" },
  EWALLET: { label: "E-Wallet", icon: "📱", color: "#8B5CF6" },
  CREDIT_CARD: { label: "Credit Card", icon: "💳", color: "#EF4444" },
  INVESTMENT: { label: "Investment", icon: "📈", color: "#F59E0B" },
};

const COLOR_PALETTE = ["#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#F59E0B", "#EC4899", "#14B8A6", "#6366F1", "#84CC16", "#F97316"];

const ICON_SUGGESTIONS = ["💵", "🏦", "💳", "📱", "💰", "💸", "🏧", "💎", "🪙", "📈"];

const AccountCard: React.FC<AccountCardProps> = ({ account, onEdit, onDelete }) => {
  const { format } = useCurrency();
  const t = useTranslations("accountsPage");

  const accountConfig = ACCOUNT_TYPE_CONFIG[account.type];
  const isCreditCard = account.type === "CREDIT_CARD";
  const balance = Number(account.balance);

  const displayBalance = isCreditCard ? Math.abs(balance) : balance;
  const balanceColor = isCreditCard || balance < 0 ? "text-red-500" : "text-primary-900";

  const creditLimit = account.creditLimit ? Number(account.creditLimit) : null;
  const utilisation = creditLimit && creditLimit > 0 ? Math.min((Math.abs(balance) / creditLimit) * 100, 100) : null;
  const utilisationColor = utilisation === null ? "" : utilisation >= 90 ? "bg-red-500" : utilisation >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Card variant="elevated" className="transition-all duration-300 hover:shadow-xl group">
      <CardContent className="pt-4 sm:pt-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div
            className="flex items-center justify-center text-2xl transition-transform sm:text-3xl w-11 h-11 sm:w-14 sm:h-14 rounded-2xl group-hover:scale-110"
            style={{ backgroundColor: (account.color ?? accountConfig.color) + "20" }}
          >
            {account.icon || accountConfig.icon}
          </div>
          <div className="flex flex-col items-end gap-1">
            {account.isDefault && (
              <Badge variant="info" className="text-xs">
                ⭐ {t("default")}
              </Badge>
            )}
            {isCreditCard && (
              <Badge variant="error" className="text-xs">
                💳 {t("types.credit_card")}
              </Badge>
            )}
          </div>
        </div>

        <h3 className="mb-1.5 text-base sm:text-xl font-bold truncate text-primary-900 sm:mb-2" title={account.name}>
          {account.name}
        </h3>

        {!isCreditCard && (
          <Badge variant="outline" className="mb-3 text-xs sm:mb-4">
            {accountConfig.icon} {t(`types.${account.type.toLowerCase()}`)}
          </Badge>
        )}

        <div className="mb-3 sm:mb-4">
          {isCreditCard ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-500">{t("creditCard.debtLabel", { defaultValue: "Debt owed" })}</p>
              <p className={`text-xl sm:text-3xl font-bold tabular-nums ${balanceColor}`}>{format(displayBalance)}</p>

              {creditLimit !== null && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-primary-500">
                    <span>{t("creditCard.limitLabel", { defaultValue: "Credit limit" })}</span>
                    <span className="tabular-nums">{format(creditLimit)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-primary-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${utilisationColor}`} style={{ width: `${utilisation ?? 0}%` }} />
                  </div>
                  <p className="text-xs text-right text-primary-400">
                    {utilisation?.toFixed(0)}% {t("creditCard.used", { defaultValue: "used" })}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className={`text-xl sm:text-3xl font-bold tabular-nums ${balanceColor}`}>{format(balance)}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm" onClick={() => onEdit(account)}>
            ✏️ {t("editButton")}
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(account.id)} aria-label={t("deleteButton")} className="px-2 sm:px-3">
            🗑️
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState: React.FC<EmptyStateProps> = ({ onCreateClick }) => {
  const t = useTranslations("accountsPage");
  return (
    <Card className="col-span-full">
      <CardContent className="pt-4 sm:pt-6">
        <div className="py-10 text-center sm:py-16">
          <div className="mb-3 text-4xl sm:mb-4 sm:text-6xl">💰</div>
          <h3 className="mb-1.5 text-lg font-bold sm:mb-2 sm:text-xl text-primary-900">{t("empty.title")}</h3>
          <p className="max-w-xs mx-auto mb-5 text-sm sm:max-w-md sm:mb-6 text-primary-600">{t("empty.description")}</p>
          <Button variant="primary" onClick={onCreateClick} size="md" className="w-full sm:w-auto">
            + {t("empty.action")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const FormModal: React.FC<FormModalProps> = ({ isOpen, onClose, title, onSubmit, isSubmitting, hint, hintClass, submitLabel, formData, onFormChange, isUpdateModal, accountTypeOptions }) => {
  const t = useTranslations("accountsPage");
  const isCreditCard = formData.type === "CREDIT_CARD";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-3 sm:space-y-4">
        <div className={`p-2.5 sm:p-3 rounded-lg border ${hintClass}`}>
          <p className="text-xs font-medium sm:text-sm">{hint}</p>
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

        <Select label={`${t("modal.type")} *`} options={accountTypeOptions} value={formData.type} onChange={(e) => onFormChange("type", e.target.value)} />

        {isCreditCard && (
          <div className="flex items-start gap-2 p-3 border border-red-200 rounded-lg bg-red-50">
            <span className="text-lg shrink-0">💳</span>
            <p className="text-xs text-red-700">
              {t("creditCard.balanceExplainer", {
                defaultValue: "For credit cards, the balance represents your total debt owed to the bank — not your own money. Enter the current amount you owe (e.g. 500000 if you owe Rp 500,000).",
              })}
            </p>
          </div>
        )}

        <Input
          type="number"
          label={isCreditCard ? `${t("creditCard.debtLabel", { defaultValue: "Current debt owed" })} *` : `${isUpdateModal ? t("modal.currentBalance") : t("modal.balance")} *`}
          placeholder={isCreditCard ? t("creditCard.debtPlaceholder", { defaultValue: "e.g. 500000" }) : isUpdateModal ? t("modal.currentBalancePlaceholder") : t("modal.balancePlaceholder")}
          value={formData.balance}
          onChange={(e) => onFormChange("balance", e.target.value)}
          icon={<span className="text-primary-600">Rp</span>}
          step="1000"
          min="0"
          required
        />

        {isCreditCard && (
          <Input
            type="number"
            label={t("creditCard.limitLabel", { defaultValue: "Credit limit (optional)" })}
            placeholder={t("creditCard.limitPlaceholder", { defaultValue: "e.g. 10000000" })}
            value={formData.creditLimit}
            onChange={(e) => onFormChange("creditLimit", e.target.value)}
            icon={<span className="text-primary-600">Rp</span>}
            step="1000"
            min="0"
          />
        )}

        <div className="space-y-1.5 sm:space-y-2">
          <Input label={`${t("modal.icon")} *`} type="text" placeholder="📁" value={formData.icon} onChange={(e) => onFormChange("icon", e.target.value)} maxLength={4} />
          <p className="text-xs text-primary-600">{t("modal.quickSelect")}:</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {ICON_SUGGESTIONS.map((emoji) => (
              <button key={emoji} type="button" className="p-1 text-xl transition-transform sm:text-2xl hover:scale-125" onClick={() => onFormChange("icon", emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Input label={`${t("modal.color")} *`} type="color" value={formData.color} onChange={(e) => onFormChange("color", e.target.value)} />
          <div className="flex flex-wrap justify-center flex-1 gap-1.5 sm:gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-transform hover:scale-110 ${formData.color === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => onFormChange("color", color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3 rounded-lg bg-neutral">
          <input
            type="checkbox"
            id={isUpdateModal ? "isDefaultUpdate" : "isDefault"}
            checked={formData.isDefault}
            onChange={(e) => onFormChange("isDefault", e.target.checked)}
            className="w-4 h-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500 shrink-0"
          />
          <label htmlFor={isUpdateModal ? "isDefaultUpdate" : "isDefault"} className="flex-1 text-xs font-medium sm:text-sm text-primary-900">
            {t("modal.setDefault")}
            {!isUpdateModal && <span className="block mt-0.5 text-xs text-primary-600">{t("modal.defaultHint")}</span>}
          </label>
        </div>

        {!isUpdateModal && (
          <div className="p-3 border rounded-lg sm:p-4 bg-linear-to-br from-primary-50 to-neutral border-primary-200">
            <p className="mb-2 text-xs font-medium sm:mb-3 sm:text-sm text-primary-700">{t("modal.preview")}:</p>
            <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg shadow-sm sm:gap-3 sm:p-3">
              <div className="flex items-center justify-center w-10 h-10 text-xl sm:w-12 sm:h-12 sm:text-2xl rounded-xl shrink-0" style={{ backgroundColor: formData.color + "20" }}>
                {formData.icon || "💰"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-primary-900">{formData.name || t("modal.accountNameLabel")}</p>
                <div className="flex items-center gap-1.5 mt-1 sm:gap-2">
                  <Badge variant={isCreditCard ? "error" : "outline"} className="text-xs">
                    {t(`types.${formData.type.toLowerCase()}`)}
                  </Badge>
                  {formData.isDefault && (
                    <Badge variant="info" className="text-xs">
                      {t("default")}
                    </Badge>
                  )}
                </div>
                {isCreditCard && formData.balance && <p className="mt-1 text-xs font-medium text-red-500">Debt: Rp {Number(formData.balance).toLocaleString("id-ID")}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t sm:gap-3 sm:pt-4">
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

export const Accounts: React.FC = () => {
  const t = useTranslations("accountsPage");
  const { accounts, createAccount, isCreating, deleteAccount, updateAccount, isUpdating, isDeleting } = useAccounts();
  const { format } = useCurrency();
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    type: "CASH",
    balance: "",
    creditLimit: "",
    color: "#10B981",
    icon: "💵",
    isDefault: false,
  });

  const summary = React.useMemo(() => {
    const totalAssets = accounts.filter((a) => a.type !== "CREDIT_CARD").reduce((sum, a) => sum + Number(a.balance), 0);

    const totalDebt = accounts.filter((a) => a.type === "CREDIT_CARD").reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);

    const netWorth = totalAssets - totalDebt;

    const accountsByType = accounts.reduce(
      (acc, account) => {
        acc[account.type] = (acc[account.type] || 0) + 1;
        return acc;
      },
      {} as Record<Account["type"], number>,
    );

    return { total: accounts.length, totalAssets, totalDebt, netWorth, accountsByType };
  }, [accounts]);

  const resetForm = React.useCallback((): void => {
    setFormData({ name: "", type: "CASH", balance: "", creditLimit: "", color: "#10B981", icon: "💵", isDefault: false });
  }, []);

  const openCreateModal = React.useCallback((): void => {
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);
  const closeCreateModal = React.useCallback((): void => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const openUpdateModal = React.useCallback((account: Account): void => {
    setSelectedAccount(account.id);
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.type === "CREDIT_CARD" ? Math.abs(Number(account.balance)).toString() : account.balance.toString(),
      creditLimit: account.creditLimit?.toString() ?? "",
      color: account.color || "",
      icon: account.icon || "",
      isDefault: account.isDefault,
    });
    setIsUpdateModalOpen(true);
  }, []);
  const closeUpdateModal = React.useCallback((): void => {
    setIsUpdateModalOpen(false);
    setSelectedAccount(null);
    resetForm();
  }, [resetForm]);

  const handleFormChange = React.useCallback((field: keyof FormData, value: string | boolean): void => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "type" && typeof value === "string") {
        const config = ACCOUNT_TYPE_CONFIG[value as Account["type"]];
        updated.icon = config.icon;
        updated.color = config.color;
        if (value !== "CREDIT_CARD") updated.creditLimit = "";
      }
      return updated;
    });
  }, []);

  const handleCreate = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.balance) {
        addToast({ message: t("validation.required"), type: "error" });
        return;
      }
      if (formData.name.length > 50) {
        addToast({ message: t("validation.nameTooLong"), type: "error" });
        return;
      }
      const rawBalance = parseFloat(formData.balance);
      if (isNaN(rawBalance) || rawBalance < 0) {
        addToast({ message: t("validation.invalidBalance"), type: "error" });
        return;
      }
      if (accounts.some((acc) => acc.name.toLowerCase() === formData.name.trim().toLowerCase())) {
        addToast({ message: t("validation.duplicate"), type: "error" });
        return;
      }

      const balance = formData.type === "CREDIT_CARD" ? -rawBalance : rawBalance;

      const payload: Record<string, unknown> = { ...formData, name: formData.name.trim(), balance };

      if (formData.type === "CREDIT_CARD" && formData.creditLimit) {
        payload.creditLimit = parseFloat(formData.creditLimit);
      } else {
        delete payload.creditLimit;
      }

      createAccount(payload as unknown as Parameters<typeof createAccount>[0], {
        onSuccess: () => {
          addToast({ message: t("success.created"), type: "success" });
          closeCreateModal();
        },
        onError: (error: Error) => {
          addToast({ message: error.message || t("error.create"), type: "error" });
        },
      });
    },
    [formData, accounts, createAccount, addToast, closeCreateModal, t],
  );

  const handleUpdate = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      if (!selectedAccount || !formData.name.trim() || !formData.balance) {
        addToast({ message: t("validation.required"), type: "error" });
        return;
      }
      const rawBalance = parseFloat(formData.balance);
      if (isNaN(rawBalance) || rawBalance < 0) {
        addToast({ message: t("validation.invalidBalance"), type: "error" });
        return;
      }
      if (accounts.some((acc) => acc.name.toLowerCase() === formData.name.trim().toLowerCase() && acc.id !== selectedAccount)) {
        addToast({ message: t("validation.duplicate"), type: "error" });
        return;
      }

      const balance = formData.type === "CREDIT_CARD" ? -rawBalance : rawBalance;

      const payload: Record<string, unknown> = { ...formData, name: formData.name.trim(), balance };

      if (formData.type === "CREDIT_CARD" && formData.creditLimit) {
        payload.creditLimit = parseFloat(formData.creditLimit);
      } else {
        payload.creditLimit = null;
      }

      updateAccount(
        { id: selectedAccount, data: payload as Parameters<typeof updateAccount>[0]["data"] },
        {
          onSuccess: () => {
            addToast({ message: t("success.updated"), type: "success" });
            closeUpdateModal();
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("error.update"), type: "error" });
          },
        },
      );
    },
    [selectedAccount, formData, accounts, updateAccount, addToast, closeUpdateModal, t],
  );

  const handleDeleteClick = React.useCallback((id: string): void => {
    setDeleteId(id);
  }, []);
  const handleDeleteConfirm = React.useCallback((): void => {
    if (!deleteId) return;
    deleteAccount(deleteId, {
      onSuccess: () => {
        addToast({ message: t("success.deleted"), type: "success" });
        setDeleteId(null);
      },
      onError: (error: Error) => {
        addToast({ message: error.message || t("error.delete"), type: "error" });
        setDeleteId(null);
      },
    });
  }, [deleteId, deleteAccount, addToast, t]);

  const accountTypeOptions = React.useMemo(
    () =>
      Object.entries(ACCOUNT_TYPE_CONFIG).map(([value, config]) => ({
        value,
        label: `${config.icon} ${t(`types.${value.toLowerCase()}`)}`,
      })),
    [t],
  );

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900">{t("title")}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-primary-600">{t("subtitle")}</p>
        </div>
        <Button variant="primary" size="lg" onClick={openCreateModal} className="w-full sm:w-auto">
          + {t("addButton")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <Card variant="default" className="bg-linear-to-br from-primary-50 via-primary-100 to-primary-200">
          <CardContent className="pt-4 pb-4 text-center sm:pt-5 sm:pb-5 text-primary-900">
            <p className="mb-1 text-xs opacity-80 sm:text-sm">💰 {t("summary.totalAssets", { defaultValue: "Total Assets" })}</p>
            <p className="text-xl font-bold sm:text-2xl tabular-nums">{format(summary.totalAssets)}</p>
          </CardContent>
        </Card>

        <Card variant="default" className="bg-linear-to-br from-red-50 via-red-100 to-red-200">
          <CardContent className="pt-4 pb-4 text-center text-red-900 sm:pt-5 sm:pb-5">
            <p className="mb-1 text-xs opacity-80 sm:text-sm">💳 {t("summary.totalDebt", { defaultValue: "Credit Card Debt" })}</p>
            <p className="text-xl font-bold text-red-600 sm:text-2xl tabular-nums">{format(summary.totalDebt)}</p>
          </CardContent>
        </Card>

        <Card variant="default" className={`bg-linear-to-br ${summary.netWorth >= 0 ? "from-emerald-50 via-emerald-100 to-emerald-200" : "from-red-50 via-red-100 to-red-200"}`}>
          <CardContent className="pt-4 pb-4 text-center sm:pt-5 sm:pb-5">
            <p className={`mb-1 text-xs opacity-80 sm:text-sm ${summary.netWorth >= 0 ? "text-emerald-900" : "text-red-900"}`}>📊 {t("summary.netWorth", { defaultValue: "Net Worth" })}</p>
            <p className={`text-xl font-bold sm:text-2xl tabular-nums ${summary.netWorth >= 0 ? "text-emerald-700" : "text-red-600"}`}>{format(summary.netWorth)}</p>
          </CardContent>
        </Card>
      </div>

      {accounts.length > 0 && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <h3 className="mb-2 text-xs font-medium sm:mb-3 sm:text-sm text-primary-900">{t("distribution")}</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5">
              {Object.entries(ACCOUNT_TYPE_CONFIG).map(([type, config]) => {
                const count = summary.accountsByType[type as Account["type"]] || 0;
                return (
                  <div key={type} className="p-2.5 text-center rounded-lg sm:p-3 bg-primary-50">
                    <div className="mb-1 text-xl sm:text-2xl">{config.icon}</div>
                    <p className="text-xs text-primary-600">{t(`types.${type.toLowerCase()}`)}</p>
                    <p className="text-base font-bold sm:text-lg text-primary-900">{count}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-base font-bold sm:mb-4 sm:text-xl text-primary-900">{t("yourAccounts", { count: accounts.length })}</h2>
        {accounts.length === 0 ? (
          <EmptyState onCreateClick={openCreateModal} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} onEdit={openUpdateModal} onDelete={handleDeleteClick} />
            ))}
          </div>
        )}
      </div>

      <FormModal
        isOpen={isModalOpen}
        onClose={closeCreateModal}
        title={`➕ ${t("modal.addTitle")}`}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        hint={`💡 ${t("modal.hint")}`}
        hintClass="bg-primary-50 border-primary-200 text-primary-700"
        submitLabel={t("modal.create")}
        formData={formData}
        onFormChange={handleFormChange}
        isUpdateModal={false}
        accountTypeOptions={accountTypeOptions}
      />

      <FormModal
        isOpen={isUpdateModalOpen}
        onClose={closeUpdateModal}
        title={`✏️ ${t("modal.updateTitle")}`}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        hint={`ℹ️ ${t("modal.updateHint")}`}
        hintClass="bg-blue-50 border-blue-200 text-blue-700"
        submitLabel={t("modal.update")}
        formData={formData}
        onFormChange={handleFormChange}
        isUpdateModal={true}
        accountTypeOptions={accountTypeOptions}
      />

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t("deleteModal.title")} size="sm">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-start gap-2.5 p-3 border border-red-200 rounded-lg sm:gap-3 sm:p-4 bg-red-50">
            <span className="text-xl sm:text-2xl shrink-0">⚠️</span>
            <div>
              <p className="mb-0.5 text-sm font-medium sm:mb-1 text-red-900">{t("deleteModal.confirm")}</p>
              <p className="text-xs text-red-700 sm:text-sm">{t("deleteModal.warning")}</p>
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

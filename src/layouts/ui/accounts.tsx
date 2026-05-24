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
  CREDIT_CARD: { label: "Credit Card", icon: "💳", color: "#F59E0B" },
};

const COLOR_PALETTE = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#6366F1", "#84CC16", "#F97316"];

const ICON_SUGGESTIONS = ["💵", "🏦", "💳", "📱", "💰", "💸", "🏧", "💎", "🪙", "💴"];

const AccountCard: React.FC<AccountCardProps> = ({ account, onEdit, onDelete }) => {
  const { format } = useCurrency();
  const t = useTranslations("accountsPage");
  const accountConfig = ACCOUNT_TYPE_CONFIG[account.type];
  const balance = Number(account.balance);
  const isNegative = balance < 0;

  return (
    <Card variant="elevated" className="transition-all duration-300 hover:shadow-xl group">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div
            className="flex items-center justify-center text-2xl transition-transform sm:text-3xl w-11 h-11 sm:w-14 sm:h-14 rounded-2xl group-hover:scale-110"
            style={{ backgroundColor: account.color + "20" }}
          >
            {account.icon || accountConfig.icon}
          </div>
          {account.isDefault && (
            <Badge variant="info" className="text-xs">
              ⭐ {t("default")}
            </Badge>
          )}
        </div>

        <h3 className="mb-1.5 text-base sm:text-xl font-bold truncate text-primary-900 sm:mb-2" title={account.name}>
          {account.name}
        </h3>

        <Badge variant="outline" className="mb-3 text-xs sm:mb-4">
          {accountConfig.icon} {t(`types.${account.type.toLowerCase()}`)}
        </Badge>

        <div className="mb-3 sm:mb-4">
          <p className={`text-xl sm:text-3xl font-bold tabular-nums ${isNegative || account.type === "CREDIT_CARD" ? "text-red-600" : "text-primary-900"}`}>
            {format(isNegative || account.type === "CREDIT_CARD" ? -Math.abs(balance) : Math.abs(balance))}
          </p>
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

        <Input
          type="number"
          label={`${isUpdateModal ? t("modal.currentBalance") : t("modal.balance")} *`}
          placeholder={isUpdateModal ? t("modal.currentBalancePlaceholder") : t("modal.balancePlaceholder")}
          value={formData.balance}
          onChange={(e) => onFormChange("balance", e.target.value)}
          icon={<span className="text-primary-600">Rp</span>}
          minusNumber={formData.type === "CREDIT_CARD" ? <span className="text-primary-600">-</span> : undefined}
          step="1000"
          required
        />

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
                  <Badge variant="outline" className="text-xs">
                    {t(`types.${formData.type.toLowerCase()}`)}
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

  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = React.useState<boolean>(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    type: "CASH",
    balance: "",
    color: "#10B981",
    icon: "💵",
    isDefault: false,
  });

  const summary = React.useMemo(() => {
    const totalBalance = accounts.filter((acc) => acc.type !== "CREDIT_CARD").reduce((sum, acc) => sum + Number(acc.balance), 0);
    const accountsByType = accounts.reduce(
      (acc, account) => {
        acc[account.type] = (acc[account.type] || 0) + 1;
        return acc;
      },
      {} as Record<Account["type"], number>,
    );
    return { total: accounts.length, totalBalance, accountsByType };
  }, [accounts]);

  const resetForm = React.useCallback((): void => {
    setFormData({ name: "", type: "CASH", balance: "", color: "#10B981", icon: "💵", isDefault: false });
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
    setFormData({ name: account.name, type: account.type, balance: account.balance.toString(), color: account.color || "", icon: account.icon || "", isDefault: account.isDefault });
    setIsUpdateModalOpen(true);
  }, []);

  const closeUpdateModal = React.useCallback((): void => {
    setIsUpdateModalOpen(false);
    setSelectedAccount(null);
    resetForm();
  }, [resetForm]);

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
      const balance = parseFloat(formData.balance);
      if (isNaN(balance)) {
        addToast({ message: t("validation.invalidBalance"), type: "error" });
        return;
      }
      if (accounts.some((acc) => acc.name.toLowerCase() === formData.name.trim().toLowerCase())) {
        addToast({ message: t("validation.duplicate"), type: "error" });
        return;
      }
      createAccount(
        { ...formData, name: formData.name.trim(), balance },
        {
          onSuccess: () => {
            addToast({ message: t("success.created"), type: "success" });
            closeCreateModal();
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("error.create"), type: "error" });
          },
        },
      );
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
      const balance = parseFloat(formData.balance);
      if (isNaN(balance)) {
        addToast({ message: t("validation.invalidBalance"), type: "error" });
        return;
      }
      if (accounts.some((acc) => acc.name.toLowerCase() === formData.name.trim().toLowerCase() && acc.id !== selectedAccount)) {
        addToast({ message: t("validation.duplicate"), type: "error" });
        return;
      }
      updateAccount(
        { id: selectedAccount, data: { ...formData, name: formData.name.trim(), balance } },
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

  const handleFormChange = React.useCallback((field: keyof FormData, value: string | boolean): void => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "type" && typeof value === "string") {
        const config = ACCOUNT_TYPE_CONFIG[value as Account["type"]];
        updated.icon = config.icon;
        updated.color = config.color;
      }
      return updated;
    });
  }, []);

  const accountTypeOptions = React.useMemo(() => Object.entries(ACCOUNT_TYPE_CONFIG).map(([value, config]) => ({ value, label: `${config.icon} ${t(`types.${value.toLowerCase()}`)}` })), [t]);

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

      <Card variant="default" className="bg-linear-to-br from-primary-50 via-primary-100 to-primary-200">
        <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6">
          <div className="text-center text-primary-900">
            <p className="mb-1.5 text-xs opacity-90 sm:mb-2 sm:text-sm">💰 {t("summary.totalBalance")}</p>
            <p className="text-2xl font-bold sm:text-3xl lg:text-4xl tabular-nums">{format(summary.totalBalance)}</p>
            <p className="mt-1.5 text-xs opacity-75 sm:mt-2">
              {summary.total} {summary.total === 1 ? t("summary.account") : t("summary.accounts")}
            </p>
          </div>
        </CardContent>
      </Card>

      {accounts.length > 0 && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <h3 className="mb-2 text-xs font-medium sm:mb-3 sm:text-sm text-primary-900">{t("distribution")}</h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
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

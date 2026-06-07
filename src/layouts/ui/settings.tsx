"use client";

import * as React from "react";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";

import { useSettings } from "@/hooks";

import { Card, CardContent, CardHeader, CardTitle, Button, Select, Alert, AlertTitle, AlertDescription, useToast, Skeleton, Modal, Input } from "@/components";

import { formatSettingKey } from "@/utils";

interface NotificationSettings {
  emailNotifications: boolean;
  budgetAlerts: boolean;
  weeklyReports: boolean;
  transactionAlerts: boolean;
  marketingEmails: boolean;
  language: string;
  currency: string;
  theme: string;
}

interface ToggleItemProps {
  title: string;
  description: string;
  icon: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

interface PreferenceItemProps {
  title: string;
  description: string;
  icon: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ title, description, icon, checked, onChange, disabled = false }) => {
  return (
    <div className="flex items-center justify-between px-2 py-4 transition-colors border-b rounded-lg last:border-b-0 hover:bg-neutral-50">
      <div className="flex items-center flex-1 gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <p className="font-medium text-primary-900">{title}</p>
          <p className="text-sm text-primary-600">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
      </label>
    </div>
  );
};

const PreferenceItem: React.FC<PreferenceItemProps> = ({ title, description, icon, options, value, onChange }) => {
  return (
    <div className="flex items-center justify-between px-2 py-4 transition-colors border-b rounded-lg last:border-b-0 hover:bg-neutral-50">
      <div className="flex items-center w-full gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <p className="font-medium text-primary-900">{title}</p>
          <p className="text-sm text-primary-600">{description}</p>
        </div>
      </div>
      <Select options={options} value={value} onChange={(e) => onChange(e.target.value)} parentClassName="w-72" />
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    <Skeleton className="w-64 h-8" />
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-96" />
      ))}
    </div>
  </div>
);

export const Settings: React.FC = () => {
  const t = useTranslations("settingsPage");
  const { addToast } = useToast();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { appSettingsData, getAppSetting, userSettingsData, isLoadingUserSettings, updateNotification, isUpdatingNotification, exportData, isExporting, deleteAccount, isDeleting } = useSettings();

  const [currencyOptions, themeOptions, languageOptions] = React.useMemo(() => {
    const resolve = (key: string) => {
      const setting = getAppSetting(key);
      if (!setting || !Array.isArray(setting.value)) return [];
      return setting.value as unknown as PreferenceItemProps["options"];
    };

    return [resolve("currency_options"), resolve("theme_options"), resolve("language_options")];
  }, [getAppSetting]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState<string>("");

  const enabledNotificationsCount = React.useMemo(() => {
    if (!userSettingsData) return 0;
    return userSettingsData.filter((n) => n.type === "boolean" && n.value === "true").length;
  }, [userSettingsData]);

  const notificationsCount = React.useMemo(() => {
    if (!userSettingsData) return 0;
    return userSettingsData.filter((n) => n.type === "boolean").length;
  }, [userSettingsData]);

  const handleToggleNotification = React.useCallback(
    (key: keyof NotificationSettings, value: boolean | string): void => {
      updateNotification(
        { key, value },
        {
          onSuccess: () => {
            const label = String(key)
              .replace(/([A-Z])/g, " $1")
              .trim();
            const message = typeof value === "boolean" ? `${label} ${value ? t("notifications.enabled") : t("notifications.disabled")} ✓` : `${label} ${t("notifications.updatedTo")} ${value} ✓`;
            addToast({ message, type: "success" });
          },
          onError: (error: Error) => {
            addToast({
              message: error.message || t("errors.updateFailed"),
              type: "error",
            });
          },
        },
      );
    },
    [updateNotification, addToast, t],
  );

  const handleLanguageChange = React.useCallback(
    (newLocale: string): void => {
      router.replace(pathname, { locale: newLocale });
      handleToggleNotification("language", newLocale);
    },
    [router, pathname, handleToggleNotification],
  );

  const handleExportData = React.useCallback((): void => {
    exportData(undefined, {
      onSuccess: () => {
        addToast({ message: t("dataManagement.export.success"), type: "success" });
      },
      onError: (error: Error) => {
        addToast({
          message: error.message || t("dataManagement.export.error"),
          type: "error",
        });
      },
    });
  }, [exportData, addToast, t]);

  const handleDeleteAccount = React.useCallback((): void => {
    const confirmText = t("deleteModal.confirmText");
    if (deleteConfirmText.toLowerCase() !== confirmText.toLowerCase()) {
      addToast({
        message: t("deleteModal.confirmError"),
        type: "error",
      });
      return;
    }

    deleteAccount(undefined, {
      onSuccess: () => {
        addToast({ message: t("deleteModal.success"), type: "success" });
        setIsDeleteModalOpen(false);
        setDeleteConfirmText("");
      },
      onError: (error: Error) => {
        addToast({
          message: error.message || t("errors.deleteFailed"),
          type: "error",
        });
      },
    });
  }, [deleteConfirmText, deleteAccount, addToast, t]);

  const handleQuickDisableAll = React.useCallback((): void => {
    userSettingsData?.filter((s) => s.type === "boolean").map((n) => handleToggleNotification(n.key as keyof NotificationSettings, false));

    addToast({
      message: t("notifications.allDisabled"),
      type: "success",
    });
  }, [userSettingsData, handleToggleNotification, addToast, t]);

  const handleQuickEnableAll = React.useCallback((): void => {
    userSettingsData?.filter((s) => s.type === "boolean").map((n) => handleToggleNotification(n.key as keyof NotificationSettings, true));

    addToast({
      message: t("notifications.allEnabled"),
      type: "success",
    });
  }, [userSettingsData, handleToggleNotification, addToast, t]);

  if (isLoadingUserSettings) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary-900">{t("title")}</h1>
        <p className="mt-1 text-primary-600">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card variant="elevated" className="bg-linear-to-br from-info-50 to-info-100">
          <CardContent className="pt-6">
            <div className="text-center text-primary-900">
              <p className="mb-2 text-4xl">🔔</p>
              <p className="text-2xl font-bold">
                {enabledNotificationsCount}/{notificationsCount}
              </p>
              <p className="mt-1 text-sm opacity-90">{t("stats.activeAlerts")}</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-linear-to-br from-success-50 to-success-100">
          <CardContent className="pt-6">
            <div className="text-center text-primary-900">
              <p className="mb-2 text-4xl">💾</p>
              <p className="text-2xl font-bold">{t("stats.ready")}</p>
              <p className="mt-1 text-sm opacity-90">{t("stats.dataExport")}</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-linear-to-br from-primary-50 to-primary-100">
          <CardContent className="pt-6">
            <div className="text-center text-primary-900">
              <p className="mb-2 text-4xl">
                {userSettingsData?.find((n) => n.key === "theme")?.value === "light" ? "☀️" : userSettingsData?.find((n) => n.key === "theme")?.value === "dark" ? "🌙" : "🔄"}
              </p>
              <p className="text-2xl font-bold capitalize">{userSettingsData?.find((n) => n.key === "theme")?.value}</p>
              <p className="mt-1 text-sm opacity-90">{t("stats.theme")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">🔔 {t("notifications.title")}</CardTitle>
              <p className="mt-1 text-sm text-primary-600">{t("notifications.subtitle")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleQuickDisableAll} disabled={enabledNotificationsCount === 0}>
                🔕 {t("notifications.disableAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleQuickEnableAll} disabled={enabledNotificationsCount === notificationsCount}>
                🔔 {t("notifications.enableAll")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {userSettingsData &&
              userSettingsData
                .filter((s) => s.type === "boolean")
                .map((n) => (
                  <ToggleItem
                    key={n.id}
                    icon={n.icon}
                    title={formatSettingKey(n.key)}
                    description={n.description || ""}
                    checked={n.value === "true"}
                    onChange={(checked) => handleToggleNotification(n.key as keyof NotificationSettings, checked)}
                    disabled={isUpdatingNotification}
                  />
                ))}

            <Alert variant="info" className="mt-4">
              <AlertTitle>⚡ {t("notifications.autoSave.title")}</AlertTitle>
              <AlertDescription>{t("notifications.autoSave.description")}</AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">⚙️ {t("preferences.title")}</CardTitle>
          <p className="mt-1 text-sm text-primary-600">{t("preferences.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {userSettingsData &&
              userSettingsData
                .filter((s) => s.type === "string")
                .map((n) => (
                  <PreferenceItem
                    key={n.id}
                    icon={n.icon}
                    title={formatSettingKey(n.key)}
                    description={n.description || ""}
                    options={n.key === "theme" ? themeOptions : n.key === "language" ? languageOptions : currencyOptions}
                    value={n.key === "language" ? currentLocale : n.value}
                    onChange={(value) => {
                      if (n.key === "language") {
                        handleLanguageChange(value);
                      } else {
                        handleToggleNotification(n.key as keyof NotificationSettings, value);
                      }
                    }}
                  />
                ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">💾 {t("dataManagement.title")}</CardTitle>
          <p className="mt-1 text-sm text-primary-600">{t("dataManagement.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
              <div className="flex items-start gap-3">
                <span className="text-3xl">📥</span>
                <div className="flex-1">
                  <h3 className="mb-1 font-medium text-blue-900">{t("dataManagement.export.title")}</h3>
                  <p className="mb-4 text-sm text-blue-700">{t("dataManagement.export.description")}</p>
                  <Button variant="outline" onClick={handleExportData} isLoading={isExporting} className="text-blue-700 border-blue-300 hover:bg-blue-100">
                    📥 {t("dataManagement.export.button")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <div className="flex items-start gap-3">
                <span className="text-3xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="mb-1 font-medium text-red-900">{t("dataManagement.dangerZone.title")}</h3>
                  <Alert variant="warning" className="mb-4">
                    <AlertTitle>⚠️ {t("dataManagement.dangerZone.warning.title")}</AlertTitle>
                    <AlertDescription>{t("dataManagement.dangerZone.warning.description")}</AlertDescription>
                  </Alert>
                  <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
                    🗑️ {t("dataManagement.dangerZone.button")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">ℹ️ {t("appInfo.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {appSettingsData
              ?.filter((s) => s.category === "app_information")
              .map((setting, key) => (
                <div key={setting.label + key} className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-primary-600">{setting.label}</span>
                  <span className="font-medium text-primary-900">{setting.value}</span>
                </div>
              ))}

            <div className="flex flex-wrap gap-4 pt-4 border-t">
              <a href="#" className="text-sm text-primary-600 hover:text-primary-900 hover:underline">
                📄 {t("appInfo.links.terms")}
              </a>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-900 hover:underline">
                🔒 {t("appInfo.links.privacy")}
              </a>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-900 hover:underline">
                💬 {t("appInfo.links.support")}
              </a>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-900 hover:underline">
                📝 {t("appInfo.links.changelog")}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteConfirmText("");
        }}
        title={t("deleteModal.title")}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
            <span className="text-3xl">⚠️</span>
            <div>
              <p className="mb-1 font-medium text-red-900">{t("deleteModal.warning.title")}</p>
              <p className="text-sm text-red-700">{t("deleteModal.warning.description")}</p>
              <ul className="mt-2 space-y-1 text-sm text-red-700 list-disc list-inside">
                <li>{t("deleteModal.warning.items.transactions")}</li>
                <li>{t("deleteModal.warning.items.budgets")}</li>
                <li>{t("deleteModal.warning.items.goals")}</li>
                <li>{t("deleteModal.warning.items.categories")}</li>
                <li>{t("deleteModal.warning.items.settings")}</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-primary-900">{t("deleteModal.confirmLabel", { text: `"${t("deleteModal.confirmText")}"` })}</label>
            <Input type="text" placeholder={t("deleteModal.placeholder")} value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} autoFocus />
          </div>

          <Alert variant="warning">
            <AlertTitle>📧 {t("deleteModal.finalNotice.title")}</AlertTitle>
            <AlertDescription>{t("deleteModal.finalNotice.description")}</AlertDescription>
          </Alert>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmText("");
              }}
              disabled={isDeleting}
            >
              {t("deleteModal.cancel")}
            </Button>
            <Button variant="danger" onClick={handleDeleteAccount} isLoading={isDeleting} disabled={deleteConfirmText.toLowerCase() !== t("deleteModal.confirmText").toLowerCase()}>
              {t("deleteModal.confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

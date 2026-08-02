"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { usePreferences, useSettings } from "@/hooks";
import { useTheme } from "@/providers";
import { Card, CardContent, CardHeader, CardTitle, Button, Select, Alert, AlertTitle, AlertDescription, useToast, Skeleton, Modal, Input } from "@/components";
import { formatSettingKey } from "@/utils";
import type { UserSetting } from "@/types";

const CATEGORY_ORDER = ["notifications", "appearance", "privacy", "general", "security", "billing"];

const CATEGORY_ICONS: Record<string, string> = {
  notifications: "🔔",
  appearance: "⚙️",
  privacy: "🔒",
  general: "🧭",
  security: "🛡️",
  billing: "💳",
};

const DEPENDS_ON: Record<string, string> = { weeklyReports: "emailNotifications" };

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

const ToggleItem: React.FC<ToggleItemProps> = ({ title, description, icon, checked, onChange, disabled = false }) => (
  <div className="flex items-center justify-between px-2 py-3 sm:py-4 transition-colors border-b border-primary-100 dark:border-primary-400 rounded-lg last:border-b-0 hover:bg-primary-50 dark:hover:bg-primary-300">
    <div className="flex items-center flex-1 gap-2 sm:gap-3 min-w-0">
      <span className="text-xl sm:text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary-900 dark:text-primary-900 truncate">{title}</p>
        <p className="text-xs sm:text-sm text-primary-500 dark:text-primary-700 truncate">{description}</p>
      </div>
    </div>
    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <div
        className="
        w-10 h-5 sm:w-11 sm:h-6 rounded-full
        bg-primary-200 dark:bg-primary-400
        peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-secondary-400
        peer-checked:bg-secondary-400 dark:peer-checked:bg-secondary-400
        peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
        after:content-[''] after:absolute after:top-0.5 after:left-0.5
        after:bg-white after:border after:border-primary-200 dark:after:border-primary-400
        after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5
        after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white
      "
      />
    </label>
  </div>
);

const PlainItem: React.FC<{ title: string; description: string; icon: string; children: React.ReactNode }> = ({ title, description, icon, children }) => (
  <div className="flex flex-col gap-2 px-2 py-3 sm:py-4 transition-colors border-b border-primary-100 dark:border-primary-400 rounded-lg last:border-b-0 hover:bg-primary-50 dark:hover:bg-primary-300 sm:flex-row sm:items-center">
    <div className="flex items-center flex-1 gap-2 sm:gap-3 min-w-0">
      <span className="text-xl sm:text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary-900 dark:text-primary-900">{title}</p>
        <p className="text-xs sm:text-sm text-primary-500 dark:text-primary-700">{description}</p>
      </div>
    </div>
    <div className="w-full sm:w-56 lg:w-72 shrink-0">{children}</div>
  </div>
);

const PreferenceItem: React.FC<PreferenceItemProps> = ({ title, description, icon, options, value, onChange }) => (
  <PlainItem title={title} description={description} icon={icon}>
    <Select options={options} value={value} onChange={(e) => onChange(e.target.value)} />
  </PlainItem>
);

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 sm:space-y-6">
    <Skeleton className="w-40 h-7 sm:w-64 sm:h-8" />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 sm:h-36" />
      ))}
    </div>
    <div className="space-y-3 sm:space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-48 sm:h-64" />
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
  const { theme: currentTheme, isDark, setTheme } = useTheme();
  const { appSettingsData, userSettingsData, isLoadingUserSettings, updateNotification, isUpdatingNotification, exportData, isExporting, deleteAccount, isDeleting } = useSettings();
  const { optionsFor } = usePreferences();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  const groupedSettings = React.useMemo(() => {
    const groups = new Map<string, UserSetting[]>();
    for (const setting of userSettingsData ?? []) {
      groups.set(setting.category, [...(groups.get(setting.category) ?? []), setting]);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const rankA = CATEGORY_ORDER.indexOf(a);
      const rankB = CATEGORY_ORDER.indexOf(b);
      return (rankA === -1 ? CATEGORY_ORDER.length : rankA) - (rankB === -1 ? CATEGORY_ORDER.length : rankB);
    });
  }, [userSettingsData]);

  const notificationToggles = React.useMemo(() => userSettingsData?.filter((s) => s.category === "notifications" && s.type === "boolean") ?? [], [userSettingsData]);
  const enabledNotificationsCount = React.useMemo(() => notificationToggles.filter((s) => s.value === "true").length, [notificationToggles]);
  const notificationsCount = notificationToggles.length;

  const settingValue = React.useCallback((key: string) => userSettingsData?.find((s) => s.key === key)?.value, [userSettingsData]);

  const labelFor = React.useCallback((setting: UserSetting) => (t.has(`settings.${setting.key}.title`) ? t(`settings.${setting.key}.title`) : formatSettingKey(setting.key)), [t]);
  const descriptionFor = React.useCallback((setting: UserSetting) => (t.has(`settings.${setting.key}.description`) ? t(`settings.${setting.key}.description`) : (setting.description ?? "")), [t]);
  const categoryTitle = React.useCallback((category: string) => (t.has(`categories.${category}`) ? t(`categories.${category}`) : formatSettingKey(category)), [t]);

  const handleToggleNotification = React.useCallback(
    (key: string, value: string | boolean): void => {
      updateNotification(
        { key, value },
        {
          onSuccess: () => {
            const label = formatSettingKey(key);
            const message = typeof value === "boolean" ? `${label} ${value ? t("notifications.enabled") : t("notifications.disabled")} ✓` : `${label} ${t("notifications.updatedTo")} ${value} ✓`;
            addToast({ message, type: "success" });
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("errors.updateFailed"), type: "error" });
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

  const handleThemeChange = React.useCallback(
    (value: string): void => {
      setTheme(value as "light" | "dark" | "system");
      handleToggleNotification("theme", value);
    },
    [setTheme, handleToggleNotification],
  );

  const handleSettingChange = React.useCallback(
    (key: string, value: string | boolean): void => {
      if (key === "language") return handleLanguageChange(String(value));
      if (key === "theme") return handleThemeChange(String(value));
      handleToggleNotification(key, value);
    },
    [handleLanguageChange, handleThemeChange, handleToggleNotification],
  );

  const handleExportData = React.useCallback((): void => {
    exportData(undefined, {
      onSuccess: () => {
        addToast({ message: t("dataManagement.export.success"), type: "success" });
      },
      onError: (error: Error) => {
        addToast({ message: error.message || t("dataManagement.export.error"), type: "error" });
      },
    });
  }, [exportData, addToast, t]);

  const handleDeleteAccount = React.useCallback((): void => {
    const confirmText = t("deleteModal.confirmText");
    if (deleteConfirmText.toLowerCase() !== confirmText.toLowerCase()) {
      addToast({ message: t("deleteModal.confirmError"), type: "error" });
      return;
    }
    deleteAccount(undefined, {
      onSuccess: () => {
        addToast({ message: t("deleteModal.success"), type: "success" });
        setIsDeleteModalOpen(false);
        setDeleteConfirmText("");
      },
      onError: (error: Error) => {
        addToast({ message: error.message || t("errors.deleteFailed"), type: "error" });
      },
    });
  }, [deleteConfirmText, deleteAccount, addToast, t]);

  const handleQuickDisableAll = React.useCallback((): void => {
    notificationToggles.forEach((n) => handleToggleNotification(n.key, false));
    addToast({ message: t("notifications.allDisabled"), type: "success" });
  }, [notificationToggles, handleToggleNotification, addToast, t]);

  const handleQuickEnableAll = React.useCallback((): void => {
    notificationToggles.forEach((n) => handleToggleNotification(n.key, true));
    addToast({ message: t("notifications.allEnabled"), type: "success" });
  }, [notificationToggles, handleToggleNotification, addToast, t]);

  if (isLoadingUserSettings) return <LoadingSkeleton />;

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900 dark:text-primary-900">{t("title")}</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:gap-4">
        <Card variant="elevated" className="bg-linear-to-br from-secondary-50 to-white dark:from-secondary-900/10 dark:to-primary-200 border border-secondary-100 dark:border-secondary-800/20">
          <CardContent className="pt-4 pb-4 sm:pt-6">
            <div className="text-center text-primary-900 dark:text-primary-900">
              <p className="mb-1.5 sm:mb-2 text-3xl sm:text-4xl">🔔</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums">
                {enabledNotificationsCount}/{notificationsCount}
              </p>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("stats.activeAlerts")}</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-linear-to-br from-primary-50 to-white dark:from-primary-100/20 dark:to-primary-200 border border-primary-100 dark:border-primary-300">
          <CardContent className="pt-4 pb-4 sm:pt-6">
            <div className="text-center text-primary-900 dark:text-primary-900">
              <p className="mb-1.5 sm:mb-2 text-3xl sm:text-4xl">💾</p>
              <p className="text-xl sm:text-2xl font-bold">{t("stats.ready")}</p>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("stats.dataExport")}</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-linear-to-br from-primary-100 to-white dark:from-primary-200/20 dark:to-primary-200 border border-primary-200 dark:border-primary-400">
          <CardContent className="pt-4 pb-4 sm:pt-6">
            <div className="text-center text-primary-900 dark:text-primary-900">
              <p className="mb-1.5 sm:mb-2 text-3xl sm:text-4xl">{currentTheme === "system" ? "🔄" : isDark ? "🌙" : "☀️"}</p>
              <p className="text-xl sm:text-2xl font-bold capitalize">{currentTheme}</p>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("stats.theme")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {groupedSettings.map(([category, settings]) => (
        <Card key={category} className="dark:bg-primary-200 dark:border-primary-400">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl dark:text-primary-900">
                  {CATEGORY_ICONS[category] ?? "⚙️"} {categoryTitle(category)}
                </CardTitle>
                {t.has(`categoryDescriptions.${category}`) && <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t(`categoryDescriptions.${category}`)}</p>}
              </div>
              {category === "notifications" && notificationsCount > 0 && (
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={handleQuickDisableAll} disabled={enabledNotificationsCount === 0} className="text-xs sm:text-sm">
                    🔕 {t("notifications.disableAll")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleQuickEnableAll} disabled={enabledNotificationsCount === notificationsCount} className="text-xs sm:text-sm">
                    🔔 {t("notifications.enableAll")}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {settings.map((setting) => {
                const dependency = DEPENDS_ON[setting.key];
                const isBlocked = !!dependency && settingValue(dependency) === "false";
                const description = isBlocked && t.has("preferences.requires") ? t("preferences.requires", { setting: formatSettingKey(dependency) }) : descriptionFor(setting);

                if (setting.type === "boolean") {
                  return (
                    <ToggleItem
                      key={setting.id}
                      icon={setting.icon}
                      title={labelFor(setting)}
                      description={description}
                      checked={setting.value === "true"}
                      onChange={(checked) => handleSettingChange(setting.key, checked)}
                      disabled={isUpdatingNotification || isBlocked}
                    />
                  );
                }

                const options = optionsFor(setting.key);

                const value = setting.key === "theme" ? currentTheme : setting.key === "language" ? currentLocale : setting.value;

                if (options.length === 0) {
                  return (
                    <PlainItem key={setting.id} icon={setting.icon} title={labelFor(setting)} description={description}>
                      <Input
                        type={setting.type === "number" ? "number" : "text"}
                        defaultValue={setting.value}
                        onBlur={(e) => {
                          if (e.target.value !== setting.value) handleSettingChange(setting.key, e.target.value);
                        }}
                      />
                    </PlainItem>
                  );
                }

                return (
                  <PreferenceItem
                    key={setting.id}
                    icon={setting.icon}
                    title={labelFor(setting)}
                    description={description}
                    options={options}
                    value={value}
                    onChange={(next) => handleSettingChange(setting.key, next)}
                  />
                );
              })}

              {category === "notifications" && (
                <Alert variant="info" className="mt-3 sm:mt-4">
                  <AlertTitle>⚡ {t("notifications.autoSave.title")}</AlertTitle>
                  <AlertDescription>{t("notifications.autoSave.description")}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl dark:text-primary-900">💾 {t("dataManagement.title")}</CardTitle>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("dataManagement.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-6">
            {/* Export */}
            <div className="p-3 sm:p-4 border border-secondary-200 dark:border-secondary-800/30 rounded-lg bg-secondary-50 dark:bg-secondary-900/10">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <span className="text-2xl sm:text-3xl shrink-0">📥</span>
                <div className="flex-1 min-w-0">
                  <h3 className="mb-0.5 sm:mb-1 text-sm sm:text-base font-medium text-secondary-700 dark:text-secondary-400">{t("dataManagement.export.title")}</h3>
                  <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-secondary-600 dark:text-secondary-500">{t("dataManagement.export.description")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                    isLoading={isExporting}
                    className="text-xs sm:text-sm text-secondary-600 dark:text-secondary-400 border-secondary-300 dark:border-secondary-700 hover:bg-secondary-100 dark:hover:bg-secondary-900/20 w-full sm:w-auto"
                  >
                    📥 {t("dataManagement.export.button")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 border border-rose-200 dark:border-rose-900/30 rounded-lg bg-rose-50 dark:bg-rose-950/20">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <span className="text-2xl sm:text-3xl shrink-0">⚠️</span>
                <div className="flex-1 min-w-0">
                  <h3 className="mb-0.5 sm:mb-1 text-sm sm:text-base font-medium text-rose-900 dark:text-rose-300">{t("dataManagement.dangerZone.title")}</h3>
                  <Alert variant="warning" className="mb-3 sm:mb-4">
                    <AlertTitle>⚠️ {t("dataManagement.dangerZone.warning.title")}</AlertTitle>
                    <AlertDescription>{t("dataManagement.dangerZone.warning.description")}</AlertDescription>
                  </Alert>
                  <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)} className="text-xs sm:text-sm w-full sm:w-auto">
                    🗑️ {t("dataManagement.dangerZone.button")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl dark:text-primary-900">ℹ️ {t("appInfo.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 sm:space-y-3">
            {appSettingsData
              ?.filter((s) => s.category === "app_information")
              .map((setting, key) => (
                <div key={setting.label + key} className="flex items-center justify-between py-1.5 sm:py-2 border-b border-primary-100 dark:border-primary-400">
                  <span className="text-xs sm:text-sm text-primary-500 dark:text-primary-700">{setting.label}</span>
                  <span className="text-xs sm:text-sm font-medium text-primary-900 dark:text-primary-900">{setting.value}</span>
                </div>
              ))}
            <div className="flex flex-wrap gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-primary-100 dark:border-primary-400">
              {[
                { key: "terms", icon: "📄" },
                { key: "privacy", icon: "🔒" },
                { key: "support", icon: "💬" },
                { key: "changelog", icon: "📝" },
              ].map(({ key, icon }) => (
                <a key={key} href="#" className="text-xs sm:text-sm text-primary-500 dark:text-primary-700 hover:text-primary-900 dark:hover:text-primary-900 hover:underline transition-colors">
                  {icon} {t(`appInfo.links.${key}`)}
                </a>
              ))}
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
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 border border-rose-200 dark:border-rose-900/30 rounded-lg bg-rose-50 dark:bg-rose-950/20">
            <span className="text-2xl sm:text-3xl shrink-0">⚠️</span>
            <div>
              <p className="mb-0.5 sm:mb-1 text-sm font-medium text-rose-900 dark:text-rose-300">{t("deleteModal.warning.title")}</p>
              <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-400">{t("deleteModal.warning.description")}</p>
              <ul className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-rose-700 dark:text-rose-400 list-disc list-inside">
                {["transactions", "budgets", "goals", "categories", "settings"].map((item) => (
                  <li key={item}>{t(`deleteModal.warning.items.${item}`)}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <label className="block mb-1.5 sm:mb-2 text-xs sm:text-sm font-medium text-primary-900 dark:text-primary-900">
              {t("deleteModal.confirmLabel", { text: `"${t("deleteModal.confirmText")}"` })}
            </label>
            <Input type="text" placeholder={t("deleteModal.placeholder")} value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} autoFocus />
          </div>

          <Alert variant="warning">
            <AlertTitle>📧 {t("deleteModal.finalNotice.title")}</AlertTitle>
            <AlertDescription>{t("deleteModal.finalNotice.description")}</AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2 pt-3 border-t border-primary-100 dark:border-primary-400 sm:flex-row sm:justify-end sm:gap-3 sm:pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmText("");
              }}
              disabled={isDeleting}
              className="text-xs sm:text-sm"
            >
              {t("deleteModal.cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAccount}
              isLoading={isDeleting}
              disabled={deleteConfirmText.toLowerCase() !== t("deleteModal.confirmText").toLowerCase()}
              className="text-xs sm:text-sm"
            >
              {t("deleteModal.confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

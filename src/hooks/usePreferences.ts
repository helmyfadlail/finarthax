"use client";

import * as React from "react";
import { useSettings } from "./api/useSettings";
import {
  BASE_CURRENCY,
  BUDGET_ALERT_THRESHOLD_OPTIONS,
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DEFAULT_TRANSACTION_TYPE_OPTIONS,
  ITEMS_PER_PAGE_OPTIONS,
  LANGUAGE_OPTIONS,
  RECURRING_LOOKAHEAD_DAYS_OPTIONS,
  THEME_OPTIONS,
  isSupportedLocale,
} from "@/static";
import { toSnakeCase } from "@/utils";
import type { SelectOption, TransactionType } from "@/types";

export interface Preferences {
  emailNotifications: boolean;
  weeklyReports: boolean;
  transactionAlerts: boolean;
  budgetAlerts: boolean;
  budgetAlertThreshold: number;
  recurringReminders: boolean;
  language: string;
  currency: string;
  theme: string;
  dateFormat: string;
  hideAmounts: boolean;
  itemsPerPage: number;
  defaultTransactionType: TransactionType;
  recurringLookaheadDays: number;
}

export const PREFERENCE_DEFAULTS: Preferences = {
  emailNotifications: true,
  weeklyReports: true,
  transactionAlerts: true,
  budgetAlerts: true,
  budgetAlertThreshold: 80,
  recurringReminders: true,
  language: "en",
  currency: BASE_CURRENCY,
  theme: "system",
  dateFormat: "dd MMM yyyy",
  hideAmounts: false,
  itemsPerPage: 20,
  defaultTransactionType: "EXPENSE",
  recurringLookaheadDays: 14,
};

const FALLBACK_OPTIONS: Record<string, SelectOption[]> = {
  language_options: LANGUAGE_OPTIONS,
  currency_options: CURRENCY_OPTIONS.map(({ value, label }) => ({ value, label })),
  theme_options: THEME_OPTIONS,
  date_format_options: DATE_FORMAT_OPTIONS,
  items_per_page_options: ITEMS_PER_PAGE_OPTIONS,
  budget_alert_threshold_options: BUDGET_ALERT_THRESHOLD_OPTIONS,
  default_transaction_type_options: DEFAULT_TRANSACTION_TYPE_OPTIONS,
  recurring_lookahead_days_options: RECURRING_LOOKAHEAD_DAYS_OPTIONS,
};

export const usePreferences = () => {
  const { getUserSetting, getAppSetting, isLoadingUserSettings } = useSettings();

  const readString = React.useCallback((key: string, fallback: string) => getUserSetting(key)?.value ?? fallback, [getUserSetting]);

  const readBoolean = React.useCallback((key: string, fallback: boolean) => (getUserSetting(key)?.value ?? String(fallback)) === "true", [getUserSetting]);

  const readNumber = React.useCallback(
    (key: string, fallback: number) => {
      const parsed = Number(getUserSetting(key)?.value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    [getUserSetting],
  );

  const preferences = React.useMemo<Preferences>(
    () => ({
      emailNotifications: readBoolean("emailNotifications", PREFERENCE_DEFAULTS.emailNotifications),
      weeklyReports: readBoolean("weeklyReports", PREFERENCE_DEFAULTS.weeklyReports),
      transactionAlerts: readBoolean("transactionAlerts", PREFERENCE_DEFAULTS.transactionAlerts),
      budgetAlerts: readBoolean("budgetAlerts", PREFERENCE_DEFAULTS.budgetAlerts),
      budgetAlertThreshold: readNumber("budgetAlertThreshold", PREFERENCE_DEFAULTS.budgetAlertThreshold),
      recurringReminders: readBoolean("recurringReminders", PREFERENCE_DEFAULTS.recurringReminders),
      language: readString("language", PREFERENCE_DEFAULTS.language),
      currency: readString("currency", PREFERENCE_DEFAULTS.currency),
      theme: readString("theme", PREFERENCE_DEFAULTS.theme),
      dateFormat: readString("dateFormat", PREFERENCE_DEFAULTS.dateFormat),
      hideAmounts: readBoolean("hideAmounts", PREFERENCE_DEFAULTS.hideAmounts),
      itemsPerPage: readNumber("itemsPerPage", PREFERENCE_DEFAULTS.itemsPerPage),
      defaultTransactionType: readString("defaultTransactionType", PREFERENCE_DEFAULTS.defaultTransactionType) as TransactionType,
      recurringLookaheadDays: readNumber("recurringLookaheadDays", PREFERENCE_DEFAULTS.recurringLookaheadDays),
    }),
    [readBoolean, readNumber, readString],
  );

  const optionsFor = React.useCallback(
    (settingKey: string): SelectOption[] => {
      const optionsKey = `${toSnakeCase(settingKey)}_options`;
      const fromDatabase = getAppSetting(optionsKey)?.value;
      const options = Array.isArray(fromDatabase) && fromDatabase.length > 0 ? (fromDatabase as unknown as SelectOption[]) : (FALLBACK_OPTIONS[optionsKey] ?? []);

      return settingKey === "language" ? options.filter((option) => isSupportedLocale(option.value)) : options;
    },
    [getAppSetting],
  );

  return { preferences, optionsFor, isLoadingPreferences: isLoadingUserSettings };
};

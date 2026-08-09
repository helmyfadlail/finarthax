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
  USER_SETTINGS,
  DEFAULT_LOCALE,
  isSupportedLocale,
} from "@/static";
import { DEFAULT_DATE_FORMAT, toSnakeCase } from "@/utils";
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

/**
 * Derived from the USER_SETTINGS catalogue rather than restated here, so the default a new account
 * is created with and the default the UI falls back to can never drift apart. Change the catalogue
 * and both move together.
 */
const CATALOGUE = Object.fromEntries(USER_SETTINGS.map((setting) => [setting.key, setting.value]));

const catalogueString = (key: keyof Preferences, fallback: string): string => CATALOGUE[key] ?? fallback;
const catalogueBoolean = (key: keyof Preferences): boolean => CATALOGUE[key] === "true";
const catalogueNumber = (key: keyof Preferences, fallback: number): number => {
  const parsed = Number(CATALOGUE[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const PREFERENCE_DEFAULTS: Preferences = {
  emailNotifications: catalogueBoolean("emailNotifications"),
  weeklyReports: catalogueBoolean("weeklyReports"),
  transactionAlerts: catalogueBoolean("transactionAlerts"),
  budgetAlerts: catalogueBoolean("budgetAlerts"),
  budgetAlertThreshold: catalogueNumber("budgetAlertThreshold", 80),
  recurringReminders: catalogueBoolean("recurringReminders"),
  language: catalogueString("language", DEFAULT_LOCALE),
  currency: catalogueString("currency", BASE_CURRENCY),
  theme: catalogueString("theme", "system"),
  dateFormat: catalogueString("dateFormat", DEFAULT_DATE_FORMAT),
  hideAmounts: catalogueBoolean("hideAmounts"),
  itemsPerPage: catalogueNumber("itemsPerPage", 20),
  defaultTransactionType: catalogueString("defaultTransactionType", "EXPENSE") as TransactionType,
  recurringLookaheadDays: catalogueNumber("recurringLookaheadDays", 14),
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

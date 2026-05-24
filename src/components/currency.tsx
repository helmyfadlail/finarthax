"use client";

import * as React from "react";

import { useSettings } from "@/hooks";

import { BASE_CURRENCY, BASE_CURRENCY_SYMBOL, CURRENCY_LOCALE_MAP, ZERO_DECIMAL_CURRENCIES } from "@/static";

interface CurrencyOption {
  value: string;
  label: string;
  symbol: string;
}

export interface CurrencyContextType {
  currency: string;
  symbol: string;
  rates: Record<string, number> | null;
  isLoading: boolean;
  format: (amount: number | string, fromCurrency?: string) => string;
  convert: (amount: number, from: string, to: string) => number;
}

const CurrencyContext = React.createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getUserSetting, getAppSetting, isLoadingUserSettings, isLoadingAppSettings, exchangeRates, isLoadingRates } = useSettings();

  const currency = React.useMemo<string>(() => {
    const setting = getUserSetting("currency");
    if (!setting) return BASE_CURRENCY;
    return setting.value;
  }, [getUserSetting]);

  const currencyOptions = React.useMemo<CurrencyOption[]>(() => {
    const setting = getAppSetting("currency_options");
    if (!setting || !Array.isArray(setting.value)) return [];
    return setting.value as unknown as CurrencyOption[];
  }, [getAppSetting]);

  const localeMap = React.useMemo<Record<string, string>>(() => {
    const setting = getAppSetting("currency_locale_map");
    if (!setting || typeof setting.value !== "object" || Array.isArray(setting.value) || setting.value === null) return CURRENCY_LOCALE_MAP;
    return setting.value as Record<string, string>;
  }, [getAppSetting]);

  const zeroDecimalSet = React.useMemo<Set<string>>(() => {
    const setting = getAppSetting("zero_decimal_currencies");
    if (!setting || !Array.isArray(setting.value)) return new Set(ZERO_DECIMAL_CURRENCIES);
    return new Set(setting.value as string[]);
  }, [getAppSetting]);

  const symbol = React.useMemo<string>(() => {
    if (currencyOptions.length === 0) return currency;
    return currencyOptions.find((o) => o.value === currency)?.symbol || BASE_CURRENCY_SYMBOL;
  }, [currency, currencyOptions]);

  const convert = React.useCallback(
    (amount: number, from: string, to: string): number => {
      if (from === to || !exchangeRates) return amount;

      if (from === BASE_CURRENCY) {
        const rate = exchangeRates[to];
        return rate ? amount * rate : amount;
      }

      if (to === BASE_CURRENCY) {
        const rate = exchangeRates[from];
        return rate ? amount / rate : amount;
      }

      const fromRate = exchangeRates[from];
      const toRate = exchangeRates[to];
      if (fromRate && toRate) return (amount / fromRate) * toRate;

      return amount;
    },
    [exchangeRates],
  );

  const format = React.useCallback(
    (amount: number | string, fromCurrency = BASE_CURRENCY): string => {
      const num = typeof amount === "string" ? parseFloat(amount) : amount;
      if (Number.isNaN(num)) return `${symbol} 0`;

      const converted = convert(num, fromCurrency, currency);
      const decimals = zeroDecimalSet.has(currency) ? 0 : 2;
      const locale = localeMap[currency] ?? "en-US";

      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(converted);

      return `${symbol} ${formatted}`;
    },
    [currency, symbol, convert, zeroDecimalSet, localeMap],
  );

  const value = React.useMemo<CurrencyContextType>(
    () => ({
      currency,
      symbol,
      rates: exchangeRates ?? null,
      isLoading: isLoadingUserSettings || isLoadingAppSettings || isLoadingRates,
      format,
      convert,
    }),
    [currency, symbol, exchangeRates, isLoadingUserSettings, isLoadingAppSettings, isLoadingRates, format, convert],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextType => {
  const ctx = React.useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within <CurrencyProvider>");
  return ctx;
};

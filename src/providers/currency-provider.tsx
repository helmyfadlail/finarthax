"use client";

import * as React from "react";
import { useSettings } from "@/hooks";
import { BASE_CURRENCY, BASE_CURRENCY_SYMBOL, CURRENCY_LOCALE_MAP, ZERO_DECIMAL_CURRENCIES } from "@/static";

interface CurrencyOption {
  value: string;
  label: string;
  symbol: string;
}

interface CurrencyContextType {
  currency: string;
  symbol: string;
  rates: Record<string, number> | null;
  isLoading: boolean;
  format: (amount: number | string, fromCurrency?: string) => string;
  convert: (amount: number, from: string, to: string) => number;
}

const resolveLocaleMap = (dbValue: unknown): Record<string, string> => {
  if (dbValue && typeof dbValue === "object" && !Array.isArray(dbValue)) return dbValue as Record<string, string>;
  return CURRENCY_LOCALE_MAP;
};

const resolveZeroDecimalSet = (dbValue: unknown): Set<string> => {
  if (Array.isArray(dbValue) && dbValue.length > 0) return new Set(dbValue as string[]);
  if (dbValue && typeof dbValue === "object" && !Array.isArray(dbValue)) {
    return new Set(Object.keys(dbValue as Record<string, string>));
  }
  return new Set(Object.keys(ZERO_DECIMAL_CURRENCIES));
};

const resolveCurrencyOptions = (dbValue: unknown): CurrencyOption[] => {
  if (Array.isArray(dbValue)) return dbValue as CurrencyOption[];
  return [];
};

const convertAmount = (amount: number, from: string, to: string, rates: Record<string, number>): number => {
  if (from === to) return amount;

  if (from === BASE_CURRENCY) return rates[to] ? amount * rates[to] : amount;

  if (to === BASE_CURRENCY) return rates[from] ? amount / rates[from] : amount;

  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate && toRate) return (amount / fromRate) * toRate;

  return amount;
};

const formatAmount = (converted: number, symbol: string, locale: string, isZeroDecimal: boolean): string => {
  const decimals = isZeroDecimal ? 0 : 2;

  const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(converted);

  return `${symbol} ${formatted}`;
};

const CurrencyContext = React.createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getUserSetting, getAppSetting, isLoadingUserSettings, isLoadingAppSettings, exchangeRates, isLoadingRates } = useSettings();

  const currency = React.useMemo<string>(() => {
    return getUserSetting("currency")?.value ?? BASE_CURRENCY;
  }, [getUserSetting]);

  const currencyOptions = React.useMemo<CurrencyOption[]>(() => {
    return resolveCurrencyOptions(getAppSetting("currency_options")?.value);
  }, [getAppSetting]);

  const localeMap = React.useMemo<Record<string, string>>(() => {
    return resolveLocaleMap(getAppSetting("currency_locale_map")?.value);
  }, [getAppSetting]);

  const zeroDecimalSet = React.useMemo<Set<string>>(() => {
    return resolveZeroDecimalSet(getAppSetting("zero_decimal_currencies")?.value);
  }, [getAppSetting]);

  const symbol = React.useMemo<string>(() => {
    return currencyOptions.find((o) => o.value === currency)?.symbol ?? BASE_CURRENCY_SYMBOL;
  }, [currency, currencyOptions]);

  const locale = React.useMemo<string>(() => {
    return localeMap[currency] ?? "en-US";
  }, [currency, localeMap]);

  const isZeroDecimal = React.useMemo<boolean>(() => {
    return zeroDecimalSet.has(currency);
  }, [currency, zeroDecimalSet]);

  const convert = React.useCallback(
    (amount: number, from: string, to: string): number => {
      if (!exchangeRates) return amount;
      return convertAmount(amount, from, to, exchangeRates);
    },
    [exchangeRates],
  );

  const format = React.useCallback(
    (amount: number | string, fromCurrency = BASE_CURRENCY): string => {
      const num = typeof amount === "string" ? parseFloat(amount) : amount;
      if (Number.isNaN(num)) return `${symbol} 0`;

      const converted = convert(num, fromCurrency, currency);
      return formatAmount(converted, symbol, locale, isZeroDecimal);
    },
    [currency, symbol, convert, locale, isZeroDecimal],
  );

  const value = React.useMemo<CurrencyContextType>(
    () => ({
      currency,
      symbol,
      rates: exchangeRates,
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

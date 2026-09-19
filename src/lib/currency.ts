import { BASE_CURRENCY, BASE_CURRENCY_SYMBOL, CURRENCY_LOCALE_MAP, CURRENCY_OPTIONS, EXCHANGE_RATE_URL, ZERO_DECIMAL_CURRENCIES } from "@/static";
import { logger } from "./logger";
import { prisma } from "./prisma";
import type { Prisma } from "prisma-client/client";

const RATES_CACHE_TTL_MS = process.env.NODE_ENV === "production" ? Number(process.env.RATES_CACHE_TTL_MS) : 0;

let cachedRates: { rates: Record<string, number>; fetchedAt: number } | null = null;

export const getExchangeRates = async (): Promise<Record<string, number> | null> => {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < RATES_CACHE_TTL_MS) return cachedRates.rates;

  try {
    const done = logger.time("currency.fetch_rates");
    const response = await fetch(`${EXCHANGE_RATE_URL}/${BASE_CURRENCY}`);
    done({ status: response.status });

    if (!response.ok) {
      logger.warn("currency.rates_unavailable", { status: response.status, servingStale: cachedRates !== null });
      return cachedRates?.rates ?? null;
    }

    const data = (await response.json()) as { rates?: Record<string, number> };
    if (!data.rates || typeof data.rates !== "object") {
      logger.warn("currency.rates_malformed", { servingStale: cachedRates !== null });
      return cachedRates?.rates ?? null;
    }

    cachedRates = { rates: data.rates, fetchedAt: Date.now() };
    return cachedRates.rates;
  } catch (error) {
    logger.error("currency.rates_failed", { servingStale: cachedRates !== null, err: error });
    return cachedRates?.rates ?? null;
  }
};

const convert = (amount: number, to: string, rates: Record<string, number> | null): number => {
  if (to === BASE_CURRENCY || !rates) return amount;
  return rates[to] ? amount * rates[to] : amount;
};

export const convertToBase = (amount: number, fromCurrency: string, rates: Record<string, number> | null): number => {
  if (fromCurrency === BASE_CURRENCY || !rates) return amount;
  const rate = rates[fromCurrency];
  return rate ? amount / rate : amount;
};

export const sumTransactionAmounts = async (where: Prisma.TransactionWhereInput): Promise<number> => {
  const rows = await prisma.transaction.findMany({ where, select: { amount: true, account: { select: { currency: true } } } });
  if (rows.length === 0) return 0;

  const needsConversion = rows.some((row) => row.account.currency !== BASE_CURRENCY);
  const rates = needsConversion ? await getExchangeRates() : null;

  return rows.reduce((total, row) => total + convertToBase(row.amount.toNumber(), row.account.currency, rates), 0);
};

export const createAmountFormatter = async (currency: string): Promise<(amount: number) => string> => {
  const rates = currency === BASE_CURRENCY ? null : await getExchangeRates();

  const symbol = CURRENCY_OPTIONS.find((option) => option.value === currency)?.symbol ?? BASE_CURRENCY_SYMBOL;
  const locale = (CURRENCY_LOCALE_MAP as Record<string, string>)[currency] ?? "en-US";
  const decimals = currency in ZERO_DECIMAL_CURRENCIES ? 0 : 2;

  return (amount: number) => {
    const converted = convert(amount, currency, rates);
    const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(converted);
    return `${symbol} ${formatted}`;
  };
};

import { BASE_CURRENCY, BASE_CURRENCY_SYMBOL, CURRENCY_LOCALE_MAP, CURRENCY_OPTIONS, EXCHANGE_RATE_URL, ZERO_DECIMAL_CURRENCIES } from "@/static";

const RATES_TTL_MS = 60 * 60 * 1000;

let cachedRates: { rates: Record<string, number>; fetchedAt: number } | null = null;

export const getExchangeRates = async (): Promise<Record<string, number> | null> => {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < RATES_TTL_MS) return cachedRates.rates;

  try {
    const response = await fetch(`${EXCHANGE_RATE_URL}/${BASE_CURRENCY}`);
    if (!response.ok) return cachedRates?.rates ?? null;

    const data = (await response.json()) as { rates?: Record<string, number> };
    if (!data.rates || typeof data.rates !== "object") return cachedRates?.rates ?? null;

    cachedRates = { rates: data.rates, fetchedAt: Date.now() };
    return cachedRates.rates;
  } catch (error) {
    console.error("[exchange-rates]", error);
    return cachedRates?.rates ?? null;
  }
};

const convert = (amount: number, to: string, rates: Record<string, number> | null): number => {
  if (to === BASE_CURRENCY || !rates) return amount;
  return rates[to] ? amount * rates[to] : amount;
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

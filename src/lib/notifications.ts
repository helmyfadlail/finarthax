import { createTranslator } from "next-intl";
import { createAmountFormatter, getUserPreferences, isMailerConfigured, prisma, readBooleanPreference, readNumberPreference, renderEmail, sendEmail, appUrl } from "@/lib";
import { BASE_CURRENCY, DEFAULT_LOCALE, isSupportedLocale } from "@/static";
import { formattedDate } from "@/utils";
import type { EmailContent } from "@/lib/mailer";

export type EmailNotificationKind = "transactionAlerts" | "budgetAlerts" | "recurringReminders" | "weeklyReports";

export interface NotificationOutcome {
  sent: boolean;
  reason?: "not-configured" | "no-recipient" | "master-disabled" | "preference-disabled" | "nothing-to-send" | "failed";
}

type Translator = Awaited<ReturnType<typeof getEmailTranslator>>;

interface NotificationContext {
  email: string;
  name: string;
  preferences: Record<string, string>;
  formatAmount: (amount: number) => string;
  formatDate: (value: Date | string) => string;
  t: Translator;
}

interface BuiltEmail {
  subject: string;
  content: EmailContent;
}

const getEmailTranslator = async (language?: string) => {
  const locale = isSupportedLocale(language) ? (language as string) : DEFAULT_LOCALE;

  try {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    return createTranslator({ locale, messages, namespace: "emails" });
  } catch {
    const messages = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
    return createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "emails" });
  }
};

const buildContext = async (userId: string): Promise<NotificationContext | null> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user?.email) return null;

  const preferences = await getUserPreferences(userId);
  const formatAmount = await createAmountFormatter(preferences.currency ?? BASE_CURRENCY);
  const dateFormat = preferences.dateFormat;

  return {
    email: user.email,
    name: user.name,
    preferences,
    formatAmount,
    formatDate: (value) => formattedDate(value, dateFormat),
    t: await getEmailTranslator(preferences.language),
  };
};

const dispatch = async (userId: string, kind: EmailNotificationKind, build: (context: NotificationContext) => Promise<BuiltEmail | null> | BuiltEmail | null): Promise<NotificationOutcome> => {
  if (!isMailerConfigured()) return { sent: false, reason: "not-configured" };

  const context = await buildContext(userId);
  if (!context) return { sent: false, reason: "no-recipient" };

  if (!readBooleanPreference(context.preferences, "emailNotifications")) return { sent: false, reason: "master-disabled" };
  if (!readBooleanPreference(context.preferences, kind)) return { sent: false, reason: "preference-disabled" };

  const message = await build(context);
  if (!message) return { sent: false, reason: "nothing-to-send" };

  try {
    await sendEmail({ to: context.email, subject: message.subject, html: renderEmail(message.content) });
    return { sent: true };
  } catch (error) {
    console.error(`[notifications:${kind}]`, error);
    return { sent: false, reason: "failed" };
  }
};

const footer = (context: NotificationContext, reasonKey: string) => ({
  greeting: context.t("greeting", { name: context.name }),
  note: context.t(`why.${reasonKey}`),
  manageLabel: context.t("manage"),
});

export const notifyTransactionRecorded = async (
  userId: string,
  transaction: {
    type: string;
    amount: number;
    description?: string | null;
    date: Date | string;
    accountName?: string | null;
    categoryName?: string | null;
  },
): Promise<NotificationOutcome> =>
  dispatch(userId, "transactionAlerts", (context) => {
    const { t } = context;
    const typeLabel = t(`types.${transaction.type}`);

    return {
      subject: t("transaction.subject", { type: typeLabel }),
      content: {
        heading: t("transaction.heading"),
        ...footer(context, "transaction"),
        intro: transaction.description ? t("transaction.introNamed", { description: transaction.description }) : t("transaction.intro"),
        rows: [
          { label: t("labels.type"), value: typeLabel },
          { label: t("labels.amount"), value: context.formatAmount(transaction.amount), emphasis: transaction.type === "INCOME" ? "positive" : "negative" },
          ...(transaction.accountName ? [{ label: t("labels.account"), value: transaction.accountName }] : []),
          ...(transaction.categoryName ? [{ label: t("labels.category"), value: transaction.categoryName }] : []),
          { label: t("labels.date"), value: context.formatDate(transaction.date) },
        ],
        cta: { label: t("transaction.cta"), url: `${appUrl()}/admin/dashboard/transactions` },
      },
    };
  });

export const notifyBudgetThresholdCrossed = async (userId: string, options: { categoryId: string; date: Date | string; appliedAmount: number }): Promise<NotificationOutcome> =>
  dispatch(userId, "budgetAlerts", async (context) => {
    const date = new Date(options.date);

    const budget = await prisma.budget.findFirst({
      where: { userId, categoryId: options.categoryId, month: date.getMonth() + 1, year: date.getFullYear() },
      include: { category: { select: { name: true, icon: true } } },
    });

    if (!budget) return null;

    const limit = Number(budget.amount);
    if (limit <= 0) return null;

    const spent = Number(budget.spent);
    const threshold = readNumberPreference(context.preferences, "budgetAlertThreshold", 80);

    const percentageNow = (spent / limit) * 100;
    const percentageBefore = ((spent - options.appliedAmount) / limit) * 100;

    if (percentageBefore >= threshold || percentageNow < threshold) return null;

    const { t } = context;
    const categoryName = `${budget.category.icon ?? ""} ${budget.category.name}`.trim();

    return {
      subject: t("budget.subject", { category: budget.category.name, percentage: Math.round(percentageNow) }),
      content: {
        heading: t("budget.heading"),
        ...footer(context, "budget"),
        intro: t("budget.intro", { category: budget.category.name, percentage: Math.round(percentageNow) }),
        rows: [
          { label: t("labels.category"), value: categoryName },
          { label: t("labels.spent"), value: context.formatAmount(spent), emphasis: "negative" },
          { label: t("labels.limit"), value: context.formatAmount(limit) },
          { label: t("labels.used"), value: `${percentageNow.toFixed(0)}%`, emphasis: percentageNow >= 100 ? "negative" : "neutral" },
        ],
        cta: { label: t("budget.cta"), url: `${appUrl()}/admin/dashboard/budgets` },
      },
    };
  });

export const notifyRecurringDue = async (userId: string): Promise<NotificationOutcome> =>
  dispatch(userId, "recurringReminders", async (context) => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const due = await prisma.transaction.findMany({
      where: { userId, nextOccurrence: { not: null, lte: endOfToday } },
      include: { category: { select: { name: true } } },
      orderBy: { nextOccurrence: "asc" },
      take: 20,
    });

    if (due.length === 0) return null;

    const { t } = context;

    return {
      subject: t("recurring.subject", { count: due.length }),
      content: {
        heading: t("recurring.heading"),
        ...footer(context, "recurring"),
        intro: t("recurring.intro", { count: due.length }),
        bullets: due.map((item) =>
          t("recurring.item", {
            description: item.description || item.category?.name || t("recurring.untitled"),
            amount: context.formatAmount(Number(item.amount)),
            date: context.formatDate(item.nextOccurrence as Date),
          }),
        ),
        cta: { label: t("recurring.cta"), url: `${appUrl()}/admin/dashboard/recurring` },
      },
    };
  });

export const sendWeeklyReport = async (userId: string): Promise<NotificationOutcome> =>
  dispatch(userId, "weeklyReports", async (context) => {
    const until = new Date();
    const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);

    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: since, lte: until } },
      include: { category: { select: { name: true } } },
    });

    if (transactions.length === 0) return null;

    const sum = (type: string) => transactions.filter((item) => item.type === type).reduce((total, item) => total + Number(item.amount), 0);

    const income = sum("INCOME");
    const expense = sum("EXPENSE");
    const balance = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    const byCategory = new Map<string, number>();
    for (const item of transactions) {
      if (item.type !== "EXPENSE" || !item.category) continue;
      byCategory.set(item.category.name, (byCategory.get(item.category.name) ?? 0) + Number(item.amount));
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

    const { t } = context;

    return {
      subject: t("weekly.subject"),
      content: {
        heading: t("weekly.heading"),
        ...footer(context, "weekly"),
        intro: t("weekly.intro", { from: context.formatDate(since), to: context.formatDate(until) }),
        rows: [
          { label: t("labels.income"), value: context.formatAmount(income), emphasis: "positive" },
          { label: t("labels.expense"), value: context.formatAmount(expense), emphasis: "negative" },
          { label: t("labels.balance"), value: context.formatAmount(balance), emphasis: balance >= 0 ? "positive" : "negative" },
          { label: t("labels.savingsRate"), value: `${savingsRate.toFixed(0)}%` },
          { label: t("labels.transactions"), value: String(transactions.length) },
          ...(topCategory ? [{ label: t("labels.topCategory"), value: `${topCategory[0]} — ${context.formatAmount(topCategory[1])}` }] : []),
        ],
        cta: { label: t("weekly.cta"), url: `${appUrl()}/admin/dashboard` },
      },
    };
  });

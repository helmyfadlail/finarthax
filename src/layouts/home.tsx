"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuickTransactions, useSettings } from "@/hooks";
import { useCurrency } from "@/providers";
import { Card, CardContent, Button, Input, Select, Badge, Modal, useToast, Skeleton, Img } from "@/components";
import { RECURRENCE_ICONS, RECURRENCE_INTERVALS, RECURRENCE_LABELS } from "@/static";
import type { Category, PublicAccount, PublicTransaction, QuickTransactionResources, RecurrenceInterval, ScheduledRecurrence, Transaction, TransactionType } from "@/types";

interface FormData {
  categoryId: string;
  accountId: string;
  toAccountId: string;
  amount: string;
  type: TransactionType;
  description: string;
  date: string;
  isRecurring: boolean;
  recurrenceInterval: RecurrenceInterval;
  recurrenceEndDate: string;
}

/** Every field the two-argument change handler can set; `isRecurring` has its own toggle. */
type FormTextField = Exclude<keyof FormData, "isRecurring">;

const INITIAL_FORM_DATA: FormData = {
  amount: "",
  type: "EXPENSE",
  description: "",
  date: new Date().toISOString().split("T")[0],
  categoryId: "",
  accountId: "",
  toAccountId: "",
  isRecurring: false,
  recurrenceInterval: "MONTHLY",
  recurrenceEndDate: "",
};

const TYPE_CONFIG: Record<
  TransactionType,
  {
    bg: string;
    text: string;
    badge: "success" | "error" | "info";
    prefix: string;
    icon: string;
  }
> = {
  INCOME: { bg: "bg-green-50", text: "text-green-600", badge: "success", prefix: "+", icon: "💰" },
  EXPENSE: { bg: "bg-red-50", text: "text-red-600", badge: "error", prefix: "-", icon: "💳" },
  TRANSFER: { bg: "bg-blue-50", text: "text-blue-600", badge: "info", prefix: "⇄", icon: "🔄" },
};

const isCreditCard = (account?: PublicAccount | null): boolean => account?.type === "CREDIT_CARD";

/**
 * A credit-card balance is stored negative and its magnitude is what you owe. A positive one means
 * the card is in credit, so it is shown like any other balance rather than as a debt.
 */
const isDebt = (account: PublicAccount, balance = account.balance ?? 0): boolean => isCreditCard(account) && balance < 0;

/** What to print for a balance: debts read as a positive "owed" figure. */
const displayBalance = (account: PublicAccount, balance: number): number => (isDebt(account, balance) ? Math.abs(balance) : balance);

/**
 * What this transaction does to an account's balance. Mirrors applyBalanceChange on the server, so
 * the preview and the saved result agree.
 *
 * A credit-card balance is stored negative and its magnitude is the debt, which is why an expense
 * subtracts there too — it pushes the balance further below zero.
 */
const balanceAfter = (account: PublicAccount, formData: FormData): number | null => {
  if (account.balance === undefined) return null;

  const amount = parseFloat(formData.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (account.id === formData.accountId) {
    if (formData.type === "INCOME") return account.balance + amount;
    return account.balance - amount; // EXPENSE, and the outgoing side of a TRANSFER
  }

  if (formData.type === "TRANSFER" && account.id === formData.toAccountId) return account.balance + amount;

  return null;
};

/** What POST /quick-transactions hands back, trimmed to the shape the two lists render. */
const toPublicTransaction = (transaction: Transaction): PublicTransaction => ({
  id: transaction.id,
  type: transaction.type,
  amount: Number(transaction.amount),
  description: transaction.description ?? null,
  date: transaction.date,
  isRecurring: transaction.isRecurring,
  recurrenceInterval: transaction.recurrenceInterval ?? null,
  account: transaction.account ? { id: transaction.account.id, name: transaction.account.name, icon: transaction.account.icon ?? null, type: transaction.account.type } : null,
  toAccount: transaction.toAccount ? { id: transaction.toAccount.id, name: transaction.toAccount.name, icon: transaction.toAccount.icon ?? null, type: transaction.toAccount.type } : null,
  category: transaction.category ? { id: transaction.category.id, name: transaction.category.name, icon: transaction.category.icon ?? null, color: transaction.category.color ?? null } : null,
});

const shortDateTime = (value: string): string => new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const relativeDue = (daysUntil: number): string => (daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : daysUntil === 0 ? "Due today" : `In ${daysUntil} days`);

/** One recorded transaction. Renders the same whether it came from the server or from this session. */
const ActivityRow: React.FC<{ transaction: PublicTransaction; onTrack?: (transaction: PublicTransaction) => void; isBusy?: boolean }> = ({ transaction, onTrack, isBusy = false }) => {
  const { format } = useCurrency();

  const config = TYPE_CONFIG[transaction.type] ?? TYPE_CONFIG.EXPENSE;
  const isTransfer = transaction.type === "TRANSFER";
  const subtitle = isTransfer
    ? [transaction.account?.name, transaction.toAccount?.name].filter(Boolean).join(" → ") || "—"
    : [transaction.category?.name, transaction.account?.name].filter(Boolean).join(" • ") || "—";

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-lg sm:gap-3 sm:p-3 ring-1 ring-primary-100">
      <div className="flex items-center flex-1 min-w-0 gap-2 sm:gap-3">
        <div className={`flex items-center justify-center shrink-0 w-8 h-8 text-base rounded-full sm:w-10 sm:h-10 sm:text-lg ${config.bg}`}>
          {isTransfer ? "🔄" : (transaction.category?.icon ?? config.icon)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium truncate sm:text-sm text-primary-900">
            <span className="truncate">{transaction.description || "No description"}</span>
            {transaction.isRecurring && <span className="shrink-0">🔁</span>}
          </p>
          <p className="text-xs truncate text-primary-500">
            {subtitle} · {shortDateTime(transaction.date)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className={`text-xs sm:text-sm font-bold tabular-nums ${config.text}`}>
          {config.prefix} {format(transaction.amount)}
        </p>
        {/* Only what is not already a series can be turned into one. */}
        {onTrack && !transaction.isRecurring && (
          <Button variant="outline" size="sm" onClick={() => onTrack(transaction)} disabled={isBusy} className="px-2 text-xs">
            🔁 Track
          </Button>
        )}
      </div>
    </div>
  );
};

/** A tracked series waiting to be confirmed — one tap records it with the amount it always has. */
const DueRow: React.FC<{ item: ScheduledRecurrence; onLog: (item: ScheduledRecurrence) => void; isBusy: boolean }> = ({ item, onLog, isBusy }) => {
  const { format } = useCurrency();

  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.EXPENSE;
  const isDue = item.status !== "UPCOMING";

  return (
    <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg sm:gap-3 sm:p-3 ${isDue ? "bg-white ring-1 ring-amber-200" : "bg-white ring-1 ring-primary-100"}`}>
      <div className="flex items-center flex-1 min-w-0 gap-2 sm:gap-3">
        <div className={`flex items-center justify-center shrink-0 w-8 h-8 text-base rounded-full sm:w-10 sm:h-10 sm:text-lg ${config.bg}`}>{item.category?.icon ?? RECURRENCE_ICONS[item.interval]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate sm:text-sm text-primary-900">{item.description || "No description"}</p>
          <p className="text-xs truncate text-primary-500">
            {RECURRENCE_LABELS[item.interval]} · {item.account?.name} · <span className={isDue ? "font-medium text-amber-600" : ""}>{relativeDue(item.daysUntil)}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className={`text-xs sm:text-sm font-bold tabular-nums ${config.text}`}>
          {config.prefix} {format(item.amount)}
        </p>
        <Button variant="primary" size="sm" onClick={() => onLog(item)} disabled={isBusy} className="px-2 text-xs">
          ✓ Log now
        </Button>
      </div>
    </div>
  );
};

const validateEmail = (email: string): string | null => {
  if (!email.trim()) return "Please enter your email address";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address";
  return null;
};

const validateForm = (formData: FormData): string | null => {
  if (!formData.amount || parseFloat(formData.amount) <= 0) return "Please enter a valid amount greater than 0";
  if (!formData.accountId) return "Please select an account";
  if (formData.type === "TRANSFER") {
    if (formData.toAccountId && formData.toAccountId === formData.accountId) return "Source and destination accounts must be different";
  } else {
    if (!formData.categoryId) return "Please select a category";
  }
  if (!formData.description.trim()) return "Please add a description";
  if (formData.isRecurring && formData.recurrenceEndDate && new Date(formData.recurrenceEndDate) <= new Date(formData.date)) {
    return "The repeat end date must be after the transaction date";
  }
  return null;
};

export const Home: React.FC = () => {
  const { addToast } = useToast();
  const router = useRouter();

  const { createTransaction, searchEmail, runRecurringAction, isCreating, isSearchingEmail, isRunningRecurringAction } = useQuickTransactions();
  const { getAppSetting, isLoadingAppSettings } = useSettings();
  const { format } = useCurrency();

  const homeData = React.useMemo(() => {
    const resolve = (key: string) => {
      const setting = getAppSetting(key);
      if (!setting) return "";
      return setting.value;
    };

    return {
      title: resolve("home_title"),
      description: resolve("home_description"),
      howItWorksTitle: resolve("how_it_works_title"),
      readyForMoreTitle: resolve("ready_for_more_title"),
      readyForMoreDescription: resolve("ready_for_more_description"),
    };
  }, [getAppSetting]);

  const howItWorksContent = (getAppSetting("how_it_works_content")?.value as string[]) || [];

  const [email, setEmail] = React.useState("");
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [accounts, setAccounts] = React.useState<PublicAccount[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [showsBalances, setShowsBalances] = React.useState(false);
  const [showsActivity, setShowsActivity] = React.useState(false);
  const [recentTransactions, setRecentTransactions] = React.useState<PublicTransaction[]>([]);
  const [dueRecurring, setDueRecurring] = React.useState<ScheduledRecurrence[]>([]);
  /**
   * What this browser recorded since the email was verified.
   *
   * The server list is only sent when the account owner allows it; this one always works, because
   * you cannot be shown anything here you did not just enter yourself.
   */
  const [sessionLog, setSessionLog] = React.useState<PublicTransaction[]>([]);
  const [trackTarget, setTrackTarget] = React.useState<PublicTransaction | null>(null);
  const [trackForm, setTrackForm] = React.useState<{ interval: RecurrenceInterval; endDate: string }>({ interval: "MONTHLY", endDate: "" });
  const [formData, setFormData] = React.useState<FormData>(INITIAL_FORM_DATA);

  const applyResources = (resources: QuickTransactionResources) => {
    setCategories(resources.categories);
    setAccounts(resources.accounts);
    setShowsBalances(resources.showsBalances);
    setShowsActivity(resources.showsActivity);
    setRecentTransactions(resources.recentTransactions ?? []);
    setDueRecurring(resources.dueRecurring ?? []);
  };

  /**
   * Re-reads the lookup after a write. Every balance on this page moves when a transaction is
   * recorded, and so does the schedule - without this the numbers on screen quietly go stale.
   * Failures are left silent on purpose: the write itself already reported its own outcome.
   */
  const refreshResources = () => {
    if (!email) return;
    searchEmail(email, { onSuccess: (data) => applyResources(data.data) });
  };

  /** Newest first, and what this session recorded is never dropped while the refresh is in flight. */
  const activity = React.useMemo(() => {
    if (!showsActivity) return sessionLog;
    const known = new Set(recentTransactions.map((transaction) => transaction.id));
    return [...sessionLog.filter((transaction) => !known.has(transaction.id)), ...recentTransactions];
  }, [showsActivity, sessionLog, recentTransactions]);

  const getFilteredCategories = React.useCallback(
    (type: TransactionType) => {
      if (type === "TRANSFER") return [];
      return categories.filter((c) => c.type === type);
    },
    [categories],
  );

  const getDefaultCategory = React.useCallback(
    (type: TransactionType) => {
      const filtered = getFilteredCategories(type);
      return filtered.find((c) => c.isDefault) ?? filtered[0] ?? null;
    },
    [getFilteredCategories],
  );

  const categoryOptions = React.useMemo(
    () => [{ value: "", label: "Select Category..." }, ...getFilteredCategories(formData.type).map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))],
    [formData.type, getFilteredCategories],
  );

  // The balance goes straight into the option label, so you can pick an account by how much is in it.
  const accountLabel = React.useCallback(
    (account: PublicAccount) => {
      const base = `${account.icon ?? "💳"} ${account.name}`;
      if (account.balance === undefined) return base;

      const amount = format(displayBalance(account, account.balance));
      return isDebt(account) ? `${base} — ${amount} owed` : `${base} — ${amount}`;
    },
    [format],
  );

  const accountOptions = React.useMemo(() => [{ value: "", label: "Select Account..." }, ...accounts.map((a) => ({ value: a.id, label: accountLabel(a) }))], [accounts, accountLabel]);

  const toAccountOptions = React.useMemo(
    () => [{ value: "", label: "No destination (withdrawal only)" }, ...accounts.filter((a) => a.id !== formData.accountId).map((a) => ({ value: a.id, label: accountLabel(a) }))],
    [accounts, formData.accountId, accountLabel],
  );

  const totals = React.useMemo(() => {
    if (!showsBalances) return null;

    const withBalance = accounts.filter((a) => a.balance !== undefined);
    if (withBalance.length === 0) return null;

    // Split so that assets − debt always equals net, whatever sign each balance carries.
    const debt = withBalance.filter((a) => isDebt(a)).reduce((sum, a) => sum + Math.abs(a.balance as number), 0);
    const assets = withBalance.filter((a) => !isDebt(a)).reduce((sum, a) => sum + (a.balance as number), 0);

    return { assets, debt, net: assets - debt };
  }, [accounts, showsBalances]);

  const resetForm = React.useCallback(() => setFormData(INITIAL_FORM_DATA), []);

  const handleSubmitEmail = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const error = validateEmail(email);
    if (error) {
      addToast({ message: error, type: "error" });
      return;
    }

    searchEmail(email, {
      onSuccess: (data) => {
        applyResources(data.data);
        setEmailVerified(true);
        addToast({ message: "Email verified! Ready to record transactions.", type: "success" });
      },
      onError: (error: Error) => {
        addToast({ message: error.message || "Failed to verify email. Please try again.", type: "error" });
        setEmailVerified(false);
      },
    });
  };

  const handleChangeForm = React.useCallback(
    (field: FormTextField, value: string) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        if (field === "type") {
          const newType = value as TransactionType;
          updated.toAccountId = "";
          updated.categoryId = newType === "TRANSFER" ? "" : (getDefaultCategory(newType)?.id ?? "");
        }
        if (field === "accountId" && updated.toAccountId === value) updated.toAccountId = "";
        return updated;
      });
    },
    [getDefaultCategory],
  );

  // Turning the repeat off clears the end date with it, so a date left over from a previous
  // toggle cannot ride along on the next submit.
  const handleToggleRecurring = React.useCallback(
    (isRecurring: boolean) => setFormData((prev) => ({ ...prev, isRecurring, recurrenceEndDate: isRecurring ? prev.recurrenceEndDate : "" })),
    [],
  );

  const handleSubmitForm = () => {
    const error = validateForm(formData);
    if (error) {
      addToast({ message: error, type: "error" });
      return;
    }

    const recurrence = {
      isRecurring: formData.isRecurring,
      recurrenceInterval: formData.isRecurring ? formData.recurrenceInterval : undefined,
      recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : undefined,
    };

    const payload =
      formData.type === "TRANSFER"
        ? {
            email,
            type: formData.type,
            accountId: formData.accountId,
            toAccountId: formData.toAccountId || undefined,
            amount: parseFloat(formData.amount),
            description: formData.description.trim(),
            date: new Date(formData.date).toISOString(),
            ...recurrence,
          }
        : {
            email,
            type: formData.type,
            accountId: formData.accountId,
            categoryId: formData.categoryId,
            amount: parseFloat(formData.amount),
            description: formData.description.trim(),
            date: new Date(formData.date).toISOString(),
            ...recurrence,
          };

    createTransaction(payload, {
      onSuccess: (response) => {
        const message = formData.isRecurring ? `Transaction recorded — repeating ${RECURRENCE_LABELS[formData.recurrenceInterval].toLowerCase()} 🔁` : "Transaction recorded! 🎉";
        addToast({ message, type: "success" });
        setSessionLog((previous) => [toPublicTransaction(response.data), ...previous]);
        resetForm();
        refreshResources();
      },
      onError: (error: Error) => {
        addToast({ message: error.message || "Failed to record transaction", type: "error" });
      },
    });
  };

  /** One tap: records the occurrence with the amount and account the series already carries. */
  const handleLogNow = (item: ScheduledRecurrence) => {
    runRecurringAction(
      { email, action: "log", transactionId: item.transactionId },
      {
        onSuccess: (response) => {
          addToast({ message: `Logged “${item.description || "transaction"}” 🎉`, type: "success" });
          setSessionLog((previous) => [toPublicTransaction(response.data), ...previous]);
          refreshResources();
        },
        onError: (error: Error) => addToast({ message: error.message || "Could not log this one. Please try again.", type: "error" }),
      },
    );
  };

  const openTrackModal = (transaction: PublicTransaction) => {
    setTrackTarget(transaction);
    setTrackForm({ interval: "MONTHLY", endDate: "" });
  };

  const handleTrackConfirm = () => {
    if (!trackTarget) return;

    runRecurringAction(
      {
        email,
        action: "track",
        transactionId: trackTarget.id,
        interval: trackForm.interval,
        endDate: trackForm.endDate ? new Date(trackForm.endDate).toISOString() : null,
      },
      {
        onSuccess: () => {
          addToast({ message: `Now tracking “${trackTarget.description || "transaction"}” ${RECURRENCE_LABELS[trackForm.interval].toLowerCase()} 🔁`, type: "success" });
          setTrackTarget(null);
          refreshResources();
        },
        onError: (error: Error) => addToast({ message: error.message || "Could not track this one. Please try again.", type: "error" }),
      },
    );
  };

  const config = TYPE_CONFIG[formData.type];
  const isTransfer = formData.type === "TRANSFER";

  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const selectedAccount = accounts.find((a) => a.id === formData.accountId);
  const selectedToAccount = accounts.find((a) => a.id === formData.toAccountId);

  const previewIcon = isTransfer ? "🔄" : (selectedCategory?.icon ?? "💰");
  const previewSubtitle = isTransfer
    ? [selectedAccount?.name, selectedToAccount?.name].filter(Boolean).join(" → ") || "—"
    : [selectedCategory?.name, selectedAccount?.name].filter(Boolean).join(" • ") || "—";

  const showPreview = !!formData.amount && !!formData.description;

  if (isLoadingAppSettings) {
    return (
      <div className="min-h-screen px-4 py-6 bg-linear-to-br from-primary-50 via-primary-100 to-primary-50 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:py-12">
        <div className="max-w-sm mx-auto space-y-4 sm:max-w-xl sm:space-y-5 md:max-w-2xl md:space-y-6">
          <div className="flex flex-col items-center justify-center gap-2 my-4 sm:my-6 md:my-8">
            <Skeleton className="w-10 h-10 sm:h-12 sm:w-12 md:h-14 md:w-14" />
            <Skeleton className="w-40 h-8 sm:h-10 sm:w-56 md:h-12 md:w-72" />
            <Skeleton className="w-48 h-4 sm:h-5 sm:w-72 md:h-6 md:w-96" />
          </div>
          <div className="p-4 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm sm:p-6 md:p-8">
            <Skeleton className="w-full h-32 sm:h-40 md:h-48 lg:h-56" />
          </div>
          <div className="p-4 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm sm:p-6 md:p-8">
            <div className="mb-3 space-y-2">
              <Skeleton className="w-20 h-4 sm:w-24" />
              <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
            </div>
            <Skeleton className="w-full h-10 sm:h-11 md:h-12" />
          </div>
          <div className="p-4 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm sm:p-6 md:p-8">
            <Skeleton className="w-full h-32 sm:h-40 md:h-48 lg:h-56" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-6 sm:px-4 sm:py-8 md:py-12 bg-linear-to-br from-primary-50 via-primary-100 to-primary-50">
      <div className="max-w-lg mx-auto space-y-3 sm:max-w-xl md:max-w-2xl sm:space-y-4 md:space-y-6">
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <Img src="/finarthax.png" alt="finarthax logo" width={64} height={64} objectFit="cover" priority />
          <h1 className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl md:text-4xl text-primary-900">{homeData.title}</h1>
          <p className="px-4 mt-1 text-sm sm:mt-2 sm:text-base md:text-lg text-primary-600">{homeData.description}</p>
        </div>

        <Card>
          <CardContent className="pt-3 pb-3 sm:pt-4 md:pt-6 sm:pb-4">
            <div className="flex items-start gap-2 p-3 border rounded-lg sm:gap-3 sm:p-4 bg-primary-50 border-primary-200">
              <span className="text-lg sm:text-xl md:text-2xl shrink-0">💡</span>
              <div className="flex-1 min-w-0">
                <p className="mb-1.5 sm:mb-2 text-xs sm:text-sm md:text-base font-medium text-primary-900">{homeData.howItWorksTitle}</p>
                <ul className="space-y-0.5 sm:space-y-1 text-sm sm:text-base text-primary-700">
                  {howItWorksContent.length > 0 && howItWorksContent.map((point, index) => <li key={`${index}-${point}`}>✓ {point}</li>)}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 sm:pt-4 md:pt-6">
            {!emailVerified && (
              <div className="space-y-3 sm:space-y-4">
                <Input type="email" label="Email Address *" placeholder="your.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSearchingEmail} />
                <Button variant="primary" className="w-full" size="lg" isLoading={isSearchingEmail} onClick={handleSubmitEmail}>
                  {isSearchingEmail ? "Verifying..." : "Verify Email"}
                </Button>
              </div>
            )}

            {emailVerified && (
              <>
                <div className="flex items-center justify-between p-2.5 sm:p-3 mb-3 sm:mb-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center min-w-0 gap-2">
                    <span className="text-base sm:text-xl shrink-0">✓</span>
                    <span className="text-xs font-medium text-green-900 truncate sm:text-sm">{email}</span>
                  </div>
                  <button
                    onClick={() => {
                      setEmailVerified(false);
                      setEmail("");
                      resetForm();
                      setAccounts([]);
                      setCategories([]);
                      setShowsBalances(false);
                      // Another person's email must not inherit the previous one's activity.
                      setShowsActivity(false);
                      setRecentTransactions([]);
                      setDueRecurring([]);
                      setSessionLog([]);
                    }}
                    className="ml-2 text-xs text-green-700 hover:text-green-900 shrink-0"
                  >
                    Change
                  </button>
                </div>

                {showsBalances && totals && (
                  <div className="p-3 mb-3 border rounded-lg sm:p-4 sm:mb-4 border-primary-200 bg-primary-50">
                    <div className="flex items-baseline justify-between mb-2 sm:mb-3">
                      <span className="text-xs font-medium tracking-wide uppercase text-primary-500">Your accounts</span>
                      <div className="text-right">
                        <span className={`text-base sm:text-lg font-bold tabular-nums ${totals.net >= 0 ? "text-primary-900" : "text-red-600"}`}>{format(totals.net)}</span>
                        {totals.debt > 0 && <p className="text-xs text-primary-500">{format(totals.assets)} in accounts · {format(totals.debt)} owed</p>}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {accounts
                        .filter((account) => account.balance !== undefined)
                        .map((account) => {
                          const balance = account.balance as number;
                          const projected = balanceAfter(account, formData);
                          const isTouched = projected !== null;
                          const owes = isDebt(account, isTouched ? (projected as number) : balance);

                          return (
                            <div
                              key={account.id}
                              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md transition-colors ${isTouched ? "bg-white ring-1 ring-primary-200" : ""}`}
                            >
                              <span className="flex items-center min-w-0 gap-1.5 text-xs sm:text-sm text-primary-700">
                                <span className="shrink-0">{account.icon ?? "💳"}</span>
                                <span className="truncate">{account.name}</span>
                                {owes && <span className="px-1 py-0.5 text-[10px] font-semibold rounded shrink-0 bg-red-100 text-red-600">owed</span>}
                              </span>

                              <span className="flex items-center gap-1.5 text-xs sm:text-sm shrink-0 tabular-nums">
                                <span className={isTouched ? "text-primary-400 line-through" : isDebt(account, balance) ? "text-red-600" : "text-primary-900"}>
                                  {format(displayBalance(account, balance))}
                                </span>
                                {isTouched && (
                                  <>
                                    <span className="text-primary-400">→</span>
                                    <span className={`font-semibold ${owes || (projected as number) < 0 ? "text-red-600" : "text-green-700"}`}>
                                      {format(displayBalance(account, projected as number))}
                                    </span>
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                    </div>

                    <p className="mt-2 text-xs text-primary-400">Balances update as you fill in the form — nothing is saved until you press Record.</p>
                  </div>
                )}

                {!showsBalances && (
                  <div className="p-2.5 sm:p-3 mb-3 sm:mb-4 border rounded-lg border-primary-100 bg-primary-50">
                    <p className="text-xs text-primary-600 sm:text-sm">
                      🔒 Balances stay hidden here. Turn on <span className="font-medium">Show balances on the quick-entry page</span> in Settings → Privacy to see them without signing in.
                    </p>
                  </div>
                )}

                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <Select
                      label="Type *"
                      options={[
                        { value: "EXPENSE", label: "💳 Expense" },
                        { value: "INCOME", label: "💰 Income" },
                        { value: "TRANSFER", label: "🔄 Transfer" },
                      ]}
                      value={formData.type}
                      onChange={(e) => handleChangeForm("type", e.target.value)}
                    />
                    <Input
                      type="number"
                      label="Amount *"
                      placeholder="Enter amount"
                      value={formData.amount}
                      onChange={(e) => handleChangeForm("amount", e.target.value)}
                      icon={<span className="text-primary-600">Rp</span>}
                      required
                    />
                  </div>

                  <Select
                    label={isTransfer ? "From Account *" : "Account *"}
                    options={accountOptions}
                    value={formData.accountId}
                    onChange={(e) => handleChangeForm("accountId", e.target.value)}
                    required
                  />

                  {isTransfer ? (
                    <Select label="To Account (optional)" options={toAccountOptions} value={formData.toAccountId} onChange={(e) => handleChangeForm("toAccountId", e.target.value)} />
                  ) : (
                    <Select label="Category *" options={categoryOptions} value={formData.categoryId} onChange={(e) => handleChangeForm("categoryId", e.target.value)} required />
                  )}

                  <Input type="datetime-local" label="Date *" value={formData.date} onChange={(e) => handleChangeForm("date", e.target.value)} max={new Date().toISOString().split("T")[0]} required />

                  <Input
                    type="text"
                    label="Description *"
                    placeholder="e.g., Lunch at restaurant, Salary payment, Top up GoPay"
                    value={formData.description}
                    onChange={(e) => handleChangeForm("description", e.target.value)}
                    maxLength={200}
                    required
                  />

                  <div className="p-3 border rounded-lg sm:p-4 border-primary-100 bg-primary-50">
                    <label className="flex items-start gap-2.5 cursor-pointer sm:gap-3">
                      <input
                        type="checkbox"
                        checked={formData.isRecurring}
                        onChange={(e) => handleToggleRecurring(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded cursor-pointer accent-primary-500"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium sm:text-sm text-primary-900">🔁 Repeat this transaction</span>
                        <span className="block mt-0.5 text-xs text-primary-500">Finarthax will remind you when the next one is due — nothing is created automatically.</span>
                      </span>
                    </label>

                    {formData.isRecurring && (
                      <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2 sm:gap-4">
                        <Select
                          label="Repeats"
                          options={RECURRENCE_INTERVALS.map((interval) => ({ value: interval, label: `${RECURRENCE_ICONS[interval]} ${RECURRENCE_LABELS[interval]}` }))}
                          value={formData.recurrenceInterval}
                          onChange={(e) => handleChangeForm("recurrenceInterval", e.target.value)}
                        />
                        <Input
                          type="datetime-local"
                          label="Repeat until (optional)"
                          value={formData.recurrenceEndDate}
                          onChange={(e) => handleChangeForm("recurrenceEndDate", e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {showPreview && (
                    <div className={`p-3 sm:p-4 border rounded-xl ${config.bg} border-primary-200`}>
                      <p className="mb-2 text-xs font-medium sm:mb-3 sm:text-sm text-primary-700">Preview:</p>
                      <div className="flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg shadow-sm">
                        <div className="flex items-center flex-1 min-w-0 gap-2 sm:gap-3">
                          <div
                            className={`
                            flex items-center justify-center shrink-0
                            w-8 h-8 sm:w-10 sm:h-10
                            text-base sm:text-xl rounded-full
                            ${config.bg}
                          `}
                          >
                            {previewIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate sm:text-sm md:text-base text-primary-900">{formData.description}</p>
                            <p className="text-xs truncate text-primary-600">{previewSubtitle}</p>
                            {formData.isRecurring && (
                              <p className="text-xs truncate text-primary-500">
                                {RECURRENCE_ICONS[formData.recurrenceInterval]} Repeats {RECURRENCE_LABELS[formData.recurrenceInterval].toLowerCase()}
                                {formData.recurrenceEndDate ? ` until ${new Date(formData.recurrenceEndDate).toLocaleDateString()}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold text-sm sm:text-base ${config.text}`}>
                            {config.prefix} {"Rp." + (formData.amount || "0")}
                          </p>
                          <Badge variant={config.badge} className="mt-0.5">
                            {formData.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSubmitForm} variant="primary" className="w-full" size="lg" isLoading={isCreating}>
                    ⚡ Record Transaction
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {emailVerified && dueRecurring.length > 0 && (
          <Card>
            <CardContent className="pt-3 sm:pt-4 md:pt-6">
              <div className="flex items-baseline justify-between mb-2 sm:mb-3">
                <h2 className="text-sm font-bold sm:text-base text-primary-900">🔁 Waiting for you</h2>
                <span className="text-xs text-primary-500">{dueRecurring.filter((item) => item.status !== "UPCOMING").length} due</span>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {dueRecurring.map((item) => (
                  <DueRow key={item.transactionId} item={item} onLog={handleLogNow} isBusy={isRunningRecurringAction} />
                ))}
              </div>
              <p className="mt-2 text-xs text-primary-400">Logging one records it with the amount it always has and moves the reminder to the next date.</p>
            </CardContent>
          </Card>
        )}

        {emailVerified && (activity.length > 0 || showsActivity) && (
          <Card>
            <CardContent className="pt-3 sm:pt-4 md:pt-6">
              <div className="flex items-baseline justify-between mb-2 sm:mb-3">
                <h2 className="text-sm font-bold sm:text-base text-primary-900">🧾 Recent transactions</h2>
                {!showsActivity && sessionLog.length > 0 && <span className="text-xs text-primary-500">this session</span>}
              </div>

              {activity.length === 0 ? (
                <p className="py-4 text-xs text-center text-primary-500 sm:text-sm">Nothing recorded yet — the transactions you add appear here.</p>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  {activity.map((transaction) => (
                    <ActivityRow
                      key={transaction.id}
                      transaction={transaction}
                      // Tracking rewrites a whole series, so it is only offered where the owner
                      // has opened this page up; a session-only row has no such permission.
                      onTrack={showsActivity ? openTrackModal : undefined}
                      isBusy={isRunningRecurringAction}
                    />
                  ))}
                </div>
              )}

              {!showsActivity && (
                <p className="mt-2 text-xs text-primary-400">
                  Only what you recorded here is shown. Turn on <span className="font-medium">Public activity</span> in Settings → Privacy to see your full recent history and everything that is
                  due.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="p-4 text-center border-2 border-dashed sm:p-6 rounded-xl border-primary-300 bg-primary-50">
              <div className="mb-2 text-3xl sm:mb-3 sm:text-4xl">🚀</div>
              <h3 className="mb-1.5 sm:mb-2 text-xl sm:text-2xl font-bold text-primary-900">{homeData.readyForMoreTitle}</h3>
              <p className="max-w-xs mx-auto mb-3 text-sm sm:mb-4 md:text-base text-primary-600">{homeData.readyForMoreDescription}</p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row sm:gap-3">
                <Button variant="primary" size="lg" onClick={() => router.push("/register")} className="w-full sm:w-auto">
                  Sign Up Free
                </Button>
                <Button variant="outline" size="lg" onClick={() => router.push("/login")} className="w-full sm:w-auto">
                  Sign In
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={!!trackTarget} onClose={() => setTrackTarget(null)} title="🔁 Track as recurring" size="md">
        <div className="space-y-3 sm:space-y-4">
          <div className="p-2.5 sm:p-3 border rounded-lg bg-primary-50 border-primary-100">
            <p className="text-xs font-medium sm:text-sm text-primary-700">“{trackTarget?.description || "This transaction"}” will be scheduled and suggested to you every period.</p>
          </div>
          <Select
            label="Repeats *"
            options={RECURRENCE_INTERVALS.map((interval) => ({ value: interval, label: `${RECURRENCE_ICONS[interval]} ${RECURRENCE_LABELS[interval]}` }))}
            value={trackForm.interval}
            onChange={(e) => setTrackForm((previous) => ({ ...previous, interval: e.target.value as RecurrenceInterval }))}
          />
          <Input type="datetime-local" label="Repeat until (optional)" value={trackForm.endDate} onChange={(e) => setTrackForm((previous) => ({ ...previous, endDate: e.target.value }))} />
          <p className="text-xs text-primary-500">Leave empty to keep the series running until it is stopped from the dashboard.</p>
          <div className="flex justify-end gap-2 pt-3 border-t border-primary-100 sm:gap-3">
            <Button variant="ghost" onClick={() => setTrackTarget(null)} disabled={isRunningRecurringAction} className="text-xs sm:text-sm">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleTrackConfirm} isLoading={isRunningRecurringAction} className="text-xs sm:text-sm">
              Start tracking
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

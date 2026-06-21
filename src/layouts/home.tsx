"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuickTransactions, useSettings } from "@/hooks";
import { Card, CardContent, Button, Input, Select, Badge, useToast, Skeleton, Img } from "@/components";
import type { Account, Category, TransactionType } from "@/types";

interface FormData {
  categoryId: string;
  accountId: string;
  toAccountId: string;
  amount: string;
  type: TransactionType;
  description: string;
  date: string;
}

const INITIAL_FORM_DATA: FormData = {
  amount: "",
  type: "EXPENSE",
  description: "",
  date: new Date().toISOString().split("T")[0],
  categoryId: "",
  accountId: "",
  toAccountId: "",
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
  return null;
};

export const Home: React.FC = () => {
  const { addToast } = useToast();
  const router = useRouter();

  const { createTransaction, searchEmail, isCreating, isSearchingEmail } = useQuickTransactions();
  const { getAppSetting, isLoadingAppSettings } = useSettings();

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
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [formData, setFormData] = React.useState<FormData>(INITIAL_FORM_DATA);

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

  const accountOptions = React.useMemo(() => [{ value: "", label: "Select Account..." }, ...accounts.map((a) => ({ value: a.id, label: `${a.icon} ${a.name}` }))], [accounts]);

  const toAccountOptions = React.useMemo(
    () => [{ value: "", label: "No destination (withdrawal only)" }, ...accounts.filter((a) => a.id !== formData.accountId).map((a) => ({ value: a.id, label: `${a.icon} ${a.name}` }))],
    [accounts, formData.accountId],
  );

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
        setCategories(data.data.categories);
        setAccounts(data.data.accounts);
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
    (field: keyof FormData, value: string) => {
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

  const handleSubmitForm = () => {
    const error = validateForm(formData);
    if (error) {
      addToast({ message: error, type: "error" });
      return;
    }

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
          }
        : {
            email,
            type: formData.type,
            accountId: formData.accountId,
            categoryId: formData.categoryId,
            amount: parseFloat(formData.amount),
            description: formData.description.trim(),
            date: new Date(formData.date).toISOString(),
          };

    createTransaction(payload, {
      onSuccess: () => {
        addToast({ message: "Transaction recorded! 🎉", type: "success" });
        resetForm();
      },
      onError: (error: Error) => {
        addToast({ message: error.message || "Failed to record transaction", type: "error" });
      },
    });
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
                    }}
                    className="ml-2 text-xs text-green-700 hover:text-green-900 shrink-0"
                  >
                    Change
                  </button>
                </div>

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

                  <Input type="date" label="Date *" value={formData.date} onChange={(e) => handleChangeForm("date", e.target.value)} max={new Date().toISOString().split("T")[0]} required />

                  <Input
                    type="text"
                    label="Description *"
                    placeholder="e.g., Lunch at restaurant, Salary payment, Top up GoPay"
                    value={formData.description}
                    onChange={(e) => handleChangeForm("description", e.target.value)}
                    maxLength={200}
                    required
                  />

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
    </div>
  );
};

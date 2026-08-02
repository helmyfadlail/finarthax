import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { DashboardLayout } from "@/layouts";
import { LocaleSync } from "@/providers";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance Tracker App",
  description: "Manage your money effectively with our finance tracker app. Track your income, expenses, and budgets in one place. Stay organized and make informed financial decisions with ease.",
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <NextIntlClientProvider>
      <LocaleSync>
        <DashboardLayout>{children}</DashboardLayout>
      </LocaleSync>
    </NextIntlClientProvider>
  );
}

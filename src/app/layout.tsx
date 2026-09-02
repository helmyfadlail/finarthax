import { AuthProvider, CurrencyProvider, QueryProvider, ThemeProvider } from "@/providers";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components";
import { getDatabaseHealth } from "@/lib";

export const dynamic = "force-dynamic";

const spaceGrotesk = localFont({
  src: [
    { path: "../../public/fonts/SpaceGrotesk-Light.ttf", weight: "300" },
    { path: "../../public/fonts/SpaceGrotesk-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/SpaceGrotesk-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/SpaceGrotesk-SemiBold.ttf", weight: "600" },
    { path: "../../public/fonts/SpaceGrotesk-Bold.ttf", weight: "700" },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  applicationName: "Finarthax",
  title: {
    default: "Finarthax — Personal Finance, Budget & Expense Tracker",
    template: "%s | Finarthax",
  },
  description:
    "Finarthax is a simple personal finance app to track income and expenses, build budgets, set savings goals, and export reports — so you can see where your money goes and stay in control in real time.",
  keywords: [
    "personal finance app",
    "budget tracker",
    "expense tracker",
    "income and expense tracker",
    "money management",
    "savings goals",
    "financial planning",
    "spending tracker",
  ],
  openGraph: {
    type: "website",
    siteName: "Finarthax",
    title: "Finarthax — Personal Finance, Budget & Expense Tracker",
    description: "Track income and expenses, build budgets, set savings goals, and export reports in one simple personal finance app.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finarthax — Personal Finance, Budget & Expense Tracker",
    description: "Track income and expenses, build budgets, set savings goals, and export reports in one simple personal finance app.",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isHealthy = (await getDatabaseHealth()) === "up";

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.className} antialiased`}>
        {isHealthy ? (
          <QueryProvider>
            <AuthProvider>
              <ThemeProvider>
                <ToastProvider>
                  <CurrencyProvider>{children}</CurrencyProvider>
                </ToastProvider>
              </ThemeProvider>
            </AuthProvider>
          </QueryProvider>
        ) : (
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="text-5xl">🛠️</span>
            <h1 className="text-2xl font-semibold">We&apos;ll be right back</h1>
            <p className="max-w-md text-sm text-gray-500">Finarthax is currently undergoing maintenance. We&apos;re working to restore service as quickly as possible — please check back shortly.</p>
          </main>
        )}
      </body>
    </html>
  );
}

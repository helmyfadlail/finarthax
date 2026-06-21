import { AuthProvider, CurrencyProvider, QueryProvider } from "@/providers";
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
  title: "Finarthax",
  description:
    "Stay on top of your income, expenses, and budgets with a simple financial management app. " + "Easily monitor transactions, organize your finances, and export data for better money control.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isHealthy = (await getDatabaseHealth()) === "up";

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.className} antialiased`}>
        {isHealthy ? (
          <QueryProvider>
            <AuthProvider>
              <ToastProvider>
                <CurrencyProvider>{children}</CurrencyProvider>
              </ToastProvider>
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

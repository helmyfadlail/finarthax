"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks";

export type ThemeValue = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeValue;
  isDark: boolean;
  setTheme: (value: ThemeValue) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Only the signed-in app is themed. The landing page and the whole `(auth)` group are
 * light-only designs — they paint with `bg-white`, `bg-primary-50`, `text-primary-500`,
 * all of which flip under `.dark`. Keying the class off auth state alone meant that once
 * a user signed in, visiting `/login` or `/` dragged the dashboard's dark palette onto
 * pages that have no dark treatment. Gate on the route instead.
 */
const isThemedRoute = (pathname: string | null) => Boolean(pathname && /(^|\/)admin(\/|$)/.test(pathname));

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userSettingsData } = useSettings();
  const pathname = usePathname();

  const storedTheme = isAuthenticated ? (userSettingsData?.find((setting) => setting.key === "theme")?.value as ThemeValue | undefined) : undefined;
  const [pendingTheme, setPendingTheme] = useState<ThemeValue | null>(null);
  const theme: ThemeValue = pendingTheme ?? storedTheme ?? "system";

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const isDark = isAuthenticated && isThemedRoute(pathname) && (theme === "dark" || (theme === "system" && systemPrefersDark));

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");

    return () => root.classList.remove("dark");
  }, [isDark]);

  const setTheme = (value: ThemeValue) => {
    setPendingTheme(value);
  };

  return <ThemeContext.Provider value={{ theme, isDark, setTheme }}>{children}</ThemeContext.Provider>;
}

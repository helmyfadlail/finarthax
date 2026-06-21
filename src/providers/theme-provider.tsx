"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { userSettingsData } = useSettings();

  const dbTheme = userSettingsData?.find((n) => n.key === "theme")?.value as ThemeValue | undefined;
  const [pendingTheme, setPendingTheme] = useState<ThemeValue | null>(null);
  const theme: ThemeValue = pendingTheme ?? dbTheme ?? "system";

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  const setTheme = (value: ThemeValue) => {
    setPendingTheme(value);
  };

  return <ThemeContext.Provider value={{ theme, isDark, setTheme }}>{children}</ThemeContext.Provider>;
}

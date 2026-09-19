export const ACCENT_PALETTE = ["#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899", "#d946ef", "#8b5cf6", "#6366f1"] as const;

export const ACCENT_DEFAULT = "#0ea5e9";

export const ACCENT_NEUTRAL = "#64748b";

export const accentTile = (color: string | null | undefined) => ({ backgroundColor: color || ACCENT_DEFAULT });

export const CHART_THEME = {
  light: {
    income: "#068150",
    expense: "#e01029",
    transfer: "#0b6f80",
    text: "#3d87ab",
    grid: "#a7cade",
    muted: "#3d87ab",
  },
  dark: {
    income: "#06c974",
    expense: "#ff4444",
    transfer: "#2ec4de",
    text: "#86a5b6",
    grid: "#325162",
    muted: "#86a5b6",
  },
} as const;

export type ChartColors = (typeof CHART_THEME)["light"];

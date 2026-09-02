export const ACCENT_PALETTE = [
  "#0ea5e9", // sky — the logo hue
  "#06b6d4", // cyan
  "#14b8a6", // teal
  "#22c55e", // green
  "#84cc16", // lime
  "#eab308", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#d946ef", // fuchsia
  "#8b5cf6", // violet
  "#6366f1", // indigo
] as const;

export const ACCENT_DEFAULT = "#0ea5e9";

export const ACCENT_NEUTRAL = "#64748b";

export const accentTile = (color: string | null | undefined) => ({ backgroundColor: color || ACCENT_DEFAULT });

export const CHART_THEME = {
  light: {
    income: "#068150", // success-500
    expense: "#e01029", // danger-500
    transfer: "#0b6f80", // secondary-600
    text: "#3d87ab", // primary-400
    grid: "#a7cade", // primary-200
    muted: "#3d87ab",
  },
  dark: {
    income: "#06c974", // success-400
    expense: "#ff4444", // danger-400
    transfer: "#2ec4de", // secondary-400 (dark)
    text: "#86a5b6",
    grid: "#325162", // primary-300 (dark)
    muted: "#86a5b6",
  },
} as const;

export type ChartColors = (typeof CHART_THEME)["light"];

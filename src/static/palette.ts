/**
 * Shared accent palette for user-pickable colors (categories, accounts) and charts.
 *
 * These are IDENTITY colours, not brand chrome. A category swatch has one job: to tell
 * "Food" apart from "Transport" in a pie slice a few pixels wide, in a legend dot, and in
 * an 8×8 picker grid. An earlier pass desaturated every swatch into the Finarthax mark's
 * 30–48% band and the grid collapsed into twelve shades of mud, so the band is dropped
 * here — the mark keeps its hold on the chrome (see `globals.css`), the swatches stay
 * clear. The logo hue (201°) still opens the set and is still the default.
 *
 * Every swatch sits at a ~4.5:1-on-white weight, so no one of them dominates its
 * neighbours and each stays legible on both themes without a per-theme variant. Ordered
 * by hue so the picker grid reads as a spectrum rather than a random scatter.
 */
export const ACCENT_PALETTE = [
  "#0284c7", // sky — the logo hue
  "#0e7490", // cyan
  "#0d9488", // teal
  "#16a34a", // green
  "#65a30d", // lime
  "#ca8a04", // amber
  "#ea580c", // orange
  "#dc2626", // red
  "#db2777", // pink
  "#c026d3", // fuchsia
  "#7c3aed", // violet
  "#4f46e5", // indigo
] as const;

/** Default colour for a freshly opened category / account form — the logo hue. */
export const ACCENT_DEFAULT = "#0284c7";

/** Same weight as the palette but near-desaturated, for "Other"-style catch-all rows. */
export const ACCENT_NEUTRAL = "#64748b";

/**
 * Style for the emoji tile that carries a user-chosen category / account colour.
 *
 * The colour is applied solid. Blending it into the card at 12.5% (and later 35%) alpha
 * read as a wash either way, because a tint of a colour is a pastel however saturated the
 * source is. Emoji carry their own colour, so they stay legible on a full-strength fill.
 */
export const accentTile = (color: string | null | undefined) => ({
  backgroundColor: color || ACCENT_DEFAULT,
});

/**
 * Recharts palette. Recharts takes literal colour strings, so it cannot read the
 * `--color-*` custom properties that flip on `.dark` — the two variants are resolved
 * in JS from `useTheme().isDark` instead.
 *
 * Income is green and expense is red, matching the `success` / `danger` text on the same
 * screens. They used to be secondary-teal and primary-blue, which meant the two series in
 * an income-vs-expense chart were two neighbouring blues and the reader had to consult the
 * legend to tell which line was losing them money. Chrome (axes, grid) stays on the brand
 * ramp so the chart still sits inside the logo's world.
 */
export const CHART_THEME = {
  light: {
    income: "#0b8241", // success-500
    expense: "#d4281a", // danger-500
    transfer: "#0b6f80", // secondary-600
    text: "#3d87ab", // primary-400
    grid: "#a7cade", // primary-200
    muted: "#3d87ab",
  },
  dark: {
    income: "#16b866", // success-400
    expense: "#f4695c", // danger-400
    transfer: "#2ec4de", // secondary-400 (dark)
    text: "#86a5b6",
    grid: "#325162", // primary-300 (dark)
    muted: "#86a5b6",
  },
} as const;

export type ChartColors = (typeof CHART_THEME)["light"];

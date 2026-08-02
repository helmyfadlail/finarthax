/**
 * Where each provider is mounted, and what it needs a session for.
 *
 * | Provider         | Mounted in            | Session |
 * | ---------------- | --------------------- | ------- |
 * | QueryProvider    | app/layout.tsx        | No — a client-side cache, needed by public pages too       |
 * | AuthProvider     | app/layout.tsx        | It supplies the session, so everything below can read it   |
 * | ThemeProvider    | app/layout.tsx        | Yes to take effect — dark is only applied while signed in  |
 * | ToastProvider    | app/layout.tsx        | No                                                         |
 * | CurrencyProvider | app/layout.tsx        | Optional — base currency when signed out, preference in    |
 * | LocaleSync       | app/[locale]/layout   | Yes — no-ops without an account; needs next-intl above it  |
 *
 * "Optional" means the provider is mounted globally and degrades on its own: it reads an account
 * preference when there is one and falls back to a sensible default when there is not. That keeps
 * every page — landing, login, dashboard — using the same formatting and theming code.
 *
 * Providers belong in a layout, never inside a screen component, so a page cannot accidentally
 * render without them.
 */
export * from "./auth-provider";
export * from "./query-provider";
export * from "./theme-provider";
export * from "./currency-provider";
export * from "./locale-provider";

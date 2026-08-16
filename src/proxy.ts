import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

const BYPASS_ROUTES = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password", "/reset-password/success"]);

const LOCALE_REDIRECT_ROUTES = new Set(["/admin/dashboard"]);

/**
 * Pages that used to live elsewhere. Notification emails already sent carry the old address, and so
 * do bookmarks, so the move is absorbed here rather than left to 404. Keyed without the locale
 * prefix; the prefix is put back on the way out. Targets may carry a query string.
 *
 * Recurring is now a tab on the transactions screen rather than a route of its own, so both of its
 * former addresses land on that tab. They point straight at the final URL - chaining one redirect
 * into another would cost every old link an extra round trip.
 */
const MOVED_ROUTES: Record<string, string> = {
  "/admin/dashboard/recurring": "/admin/dashboard/transactions?view=recurring",
  "/admin/dashboard/transactions/recurring": "/admin/dashboard/transactions?view=recurring",
};

const hasLocalePrefix = (pathname: string): boolean => routing.locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));

const getDefaultLocale = (): string => routing.defaultLocale ?? routing.locales[0];

/** Splits `/en/admin/…` into its locale and the rest, or returns null when there is no prefix. */
const splitLocale = (pathname: string): { locale: string; rest: string } | null => {
  const locale = routing.locales.find((candidate) => pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`));
  return locale ? { locale, rest: pathname.slice(locale.length + 1) || "/" } : null;
};

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (BYPASS_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  const split = splitLocale(pathname);
  const movedFrom = split ? split.rest : pathname;
  const movedTo = MOVED_ROUTES[movedFrom];

  if (movedTo) {
    const url = req.nextUrl.clone();
    const locale = split?.locale ?? req.cookies.get("NEXT_LOCALE")?.value ?? getDefaultLocale();
    const [movedPath, movedQuery] = movedTo.split("?");
    url.pathname = `/${locale}${movedPath}`;
    // Whatever the old link carried is dropped in favour of the target's own query - the params
    // these routes were reached with never meant anything on the page they now land on.
    if (movedQuery) url.search = movedQuery;
    return NextResponse.redirect(url, 308);
  }

  if (LOCALE_REDIRECT_ROUTES.has(pathname)) {
    const locale = req.cookies.get("NEXT_LOCALE")?.value ?? getDefaultLocale();
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  if (!hasLocalePrefix(pathname)) {
    return NextResponse.next();
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)", "/"],
};

"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Session } from "next-auth";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  PiggyBank,
  Target,
  BarChart3,
  History,
  Settings2,
  Bell,
  Settings,
  User,
  LogOut,
  X,
  MoreHorizontal,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth, useNotifications, usePreferences } from "@/hooks";
import { Dropdown, DropdownItem, DropdownDivider, AvatarImg, Img, Badge } from "@/components";
import { formatInitialName, formattedDateTime, cn } from "@/utils";
import type { Notification } from "@/types";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}
interface AccountMenuProps {
  session: Session;
  router: ReturnType<typeof useRouter>;
  logout: () => void;
  compact?: boolean;
}

const useNavigation = (role: string | undefined) => {
  const t = useTranslations("dashboard");

  const dashboard: NavItem = { name: t("nav.dashboard"), href: "/admin/dashboard", icon: LayoutDashboard };
  const transactions: NavItem = { name: t("nav.transactions"), href: "/admin/dashboard/transactions", icon: ArrowLeftRight };
  const accounts: NavItem = { name: t("nav.accounts"), href: "/admin/dashboard/accounts", icon: Wallet };
  const categories: NavItem = { name: t("nav.categories"), href: "/admin/dashboard/categories", icon: Tags };
  const budgets: NavItem = { name: t("nav.budgets"), href: "/admin/dashboard/budgets", icon: PiggyBank };
  const goals: NavItem = { name: t("nav.goals"), href: "/admin/dashboard/goals", icon: Target };
  const reports: NavItem = { name: t("nav.reports"), href: "/admin/dashboard/reports", icon: BarChart3 };
  const auditLog: NavItem = { name: t("nav.auditLog"), href: "/admin/dashboard/audit-log", icon: History };
  // Instance-wide configuration, so it is only offered to the role allowed to change it. The
  // API refuses it regardless of what is rendered here.
  const appSettings: NavItem | null = role === "SUPERADMIN" ? { name: t("nav.appSettings"), href: "/admin/dashboard/app-settings", icon: Settings2 } : null;

  const groups: NavGroup[] = [
    { label: t("navGroups.overview"), items: [dashboard] },
    { label: t("navGroups.manage"), items: [transactions, accounts, categories, budgets, goals] },
    { label: t("navGroups.insights"), items: [reports, auditLog] },
    ...(appSettings ? [{ label: t("navGroups.admin"), items: [appSettings] }] : []),
  ];

  const primary = [dashboard, transactions, accounts, budgets];
  const secondary = [categories, goals, reports, auditLog, ...(appSettings ? [appSettings] : [])];
  const all = groups.flatMap((g) => g.items);

  return { groups, primary, secondary, all };
};

const NotificationBell = () => {
  const t = useTranslations("notificationsPage");
  const router = useRouter();
  const { preferences } = usePreferences();
  const { notifications, unreadCount, isLoading, markRead, markAllRead, isMarkingAllRead } = useNotifications({ limit: 8 });

  const handleItemClick = (notification: Notification) => {
    if (!notification.isRead) markRead(notification.id);
    if (notification.link) router.push(notification.link);
  };

  return (
    <Dropdown
      align="right"
      fullWidth={false}
      width="w-[min(21rem,calc(100vw-2rem))]"
      trigger={
        <button
          aria-label={t("bellLabel")}
          className="relative flex items-center justify-center w-10 h-10 transition-all rounded-full active:scale-90 focus:outline-none focus:ring-2 focus:ring-secondary-400 hover:bg-primary-100 dark:hover:bg-primary-300"
        >
          <Bell className="w-5 h-5 text-primary-600 dark:text-primary-800" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <Badge variant="error" className="absolute top-1 right-1 px-1! py-0! min-w-[1.1rem] h-[1.1rem] flex items-center justify-center text-[10px] leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-primary-100 dark:border-primary-400">
        <span className="text-sm font-semibold text-primary-900 dark:text-primary-900">{t("title")}</span>
        {unreadCount > 0 && (
          <button onClick={() => markAllRead()} disabled={isMarkingAllRead} className="text-xs font-medium text-secondary-600 dark:text-secondary-400 hover:underline disabled:opacity-50">
            {t("markAllRead")}
          </button>
        )}
      </div>
      <div className="overflow-y-auto max-h-80">
        {isLoading ? (
          <p className="px-3 py-4 text-xs text-center md:text-sm text-primary-400 dark:text-primary-600">{t("loading")}</p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-300">
              <Bell className="w-5 h-5 text-primary-300 dark:text-primary-600" strokeWidth={1.6} />
            </div>
            <p className="text-xs md:text-sm text-primary-400 dark:text-primary-600">{t("empty")}</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleItemClick(notification)}
              className={`flex w-full gap-2 px-3.5 py-3 text-left border-b border-primary-100 dark:border-primary-400 last:border-b-0 transition-colors hover:bg-primary-50 dark:hover:bg-primary-300 ${
                !notification.isRead ? "bg-secondary-50 dark:bg-secondary-100" : ""
              }`}
            >
              {!notification.isRead && <span className="shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full bg-secondary-500" />}
              <div className={`flex-1 min-w-0 ${notification.isRead ? "ml-3.5" : ""}`}>
                <p className="text-xs font-medium truncate md:text-sm text-primary-900 dark:text-primary-900">{notification.title}</p>
                <p className="text-[11px] md:text-xs text-primary-500 dark:text-primary-700 line-clamp-2">{notification.message}</p>
                <p className="text-[10px] md:text-[11px] mt-0.5 text-primary-400 dark:text-primary-600">{formattedDateTime(notification.createdAt, preferences.dateFormat)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </Dropdown>
  );
};

const AccountMenu = ({ session, router, logout, compact = false }: AccountMenuProps) => {
  const t = useTranslations("dashboard");

  return (
    <Dropdown
      fullWidth={false}
      align="right"
      trigger={
        compact ? (
          <button
            aria-label="Account menu"
            className="flex items-center justify-center w-10 h-10 transition-all rounded-full active:scale-90 focus:outline-none focus:ring-2 focus:ring-secondary-400"
          >
            {!session.user.avatar ? (
              <div className="flex items-center justify-center w-8 h-8 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-300 dark:text-primary-900">
                {formatInitialName(session.user.name || "")}
              </div>
            ) : (
              <AvatarImg src={session.user.avatar} alt="User" size="sm" />
            )}
          </button>
        ) : (
          <button className="flex items-center gap-2 py-1.5 pl-1.5 pr-2.5 transition-colors rounded-full hover:bg-primary-100 dark:hover:bg-primary-300">
            {!session.user.avatar ? (
              <div className="flex items-center justify-center w-8 h-8 text-xs font-medium rounded-full shrink-0 bg-primary-100 text-primary-700 dark:bg-primary-300 dark:text-primary-900">
                {formatInitialName(session.user.name || "")}
              </div>
            ) : (
              <AvatarImg src={session.user.avatar} alt="User" size="sm" className="shrink-0" />
            )}
            <span className="max-w-[9rem] truncate text-sm font-medium text-primary-800 dark:text-primary-900">{session.user.name}</span>
            <ChevronDown className="w-4 h-4 text-primary-400 dark:text-primary-600" />
          </button>
        )
      }
    >
      <div className="px-3.5 py-3 border-b border-primary-100 dark:border-primary-400">
        <p className="text-sm font-semibold truncate text-primary-900 dark:text-primary-900" title={session.user.name || ""}>
          {session.user.name}
        </p>
        <p className="text-xs truncate text-primary-500 dark:text-primary-700" title={session.user.email}>
          {session.user.email}
        </p>
      </div>
      <DropdownItem icon={<Settings className="w-4 h-4" />} onClick={() => router.push("/admin/dashboard/settings")}>
        {t("menu.settings")}
      </DropdownItem>
      <DropdownItem icon={<User className="w-4 h-4" />} onClick={() => router.push("/admin/dashboard/profiles")}>
        {t("menu.profile")}
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem icon={<LogOut className="w-4 h-4" />} danger onClick={() => logout()}>
        {t("menu.logout")}
      </DropdownItem>
    </Dropdown>
  );
};

const Sidebar = ({ groups, pathname, router, t }: { groups: NavGroup[]; pathname: string; router: ReturnType<typeof useRouter>; t: ReturnType<typeof useTranslations> }) => (
  <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-white dark:bg-primary-100 border-r border-primary-100 dark:border-primary-300 md:flex md:flex-col">
    <div className="flex items-center gap-3 p-5 border-b border-primary-100 dark:border-primary-300">
      <Img src="/finarthax.png" alt="finarthax logo" width={32} height={32} objectFit="cover" priority />
      <div>
        <h1 className="text-sm font-bold leading-tight text-primary-900 dark:text-primary-900">{t("appName")}</h1>
        <p className="text-xs text-primary-500 dark:text-primary-700">{t("appTagline")}</p>
      </div>
    </div>

    <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider uppercase text-primary-400 dark:text-primary-600">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm transition-all active:scale-[0.98]",
                    isActive
                      ? "bg-primary-500 text-on-solid dark:bg-secondary-400 dark:text-on-bright shadow-sm"
                      : "text-primary-700 hover:bg-primary-50 dark:text-primary-800 dark:hover:bg-primary-200",
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
                  <span className="font-medium truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  </aside>
);

const TopBar = ({
  session,
  router,
  logout,
  title,
}: {
  session: Session;
  router: ReturnType<typeof useRouter>;
  logout: () => void;
  title: string;
}) => {
  const t = useTranslations("dashboard");

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 h-[calc(3.75rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white/90 dark:bg-primary-100/90 backdrop-blur-sm border-b border-primary-100 dark:border-primary-300 md:left-64 md:px-6">
      <div className="flex items-center gap-2 min-w-0 md:hidden">
        <Img src="/finarthax.png" alt="finarthax logo" width={26} height={26} objectFit="cover" priority />
        <span className="text-sm font-bold truncate text-primary-900 dark:text-primary-900">{t("appName")}</span>
      </div>
      <h2 className="hidden text-lg font-bold truncate text-primary-900 dark:text-primary-900 md:block">{title}</h2>

      <div className="flex items-center gap-1 shrink-0">
        <NotificationBell />
        <div className="lg:hidden">
          <AccountMenu session={session} router={router} logout={logout} compact />
        </div>
        <div className="hidden lg:block lg:ml-1">
          <AccountMenu session={session} router={router} logout={logout} />
        </div>
      </div>
    </header>
  );
};

const BottomNav = ({
  primary,
  pathname,
  router,
  onMore,
  moreLabel,
  isMoreActive,
}: {
  primary: NavItem[];
  pathname: string;
  router: ReturnType<typeof useRouter>;
  onMore: () => void;
  moreLabel: string;
  isMoreActive: boolean;
}) => (
  <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 bg-white dark:bg-primary-100 border-t border-primary-100 dark:border-primary-300 pb-[env(safe-area-inset-bottom)] md:hidden">
    {primary.map((item) => {
      const isActive = pathname === item.href;
      const Icon = item.icon;
      return (
        <button key={item.href} onClick={() => router.push(item.href)} className="flex flex-col items-center justify-center gap-1 py-2.5 active:scale-95 transition-transform">
          <span className={cn("flex items-center justify-center rounded-xl px-3.5 py-1", isActive && "bg-secondary-50 dark:bg-secondary-100")}>
            <Icon className={cn("w-5 h-5", isActive ? "text-secondary-600 dark:text-secondary-500" : "text-primary-400 dark:text-primary-600")} strokeWidth={isActive ? 2.1 : 1.8} />
          </span>
          <span className={cn("text-[10px] font-medium truncate max-w-[4rem]", isActive ? "text-secondary-600 dark:text-secondary-500" : "text-primary-400 dark:text-primary-600")}>{item.name}</span>
        </button>
      );
    })}
    <button onClick={onMore} className="flex flex-col items-center justify-center gap-1 py-2.5 active:scale-95 transition-transform">
      <span className={cn("flex items-center justify-center rounded-xl px-3.5 py-1", isMoreActive && "bg-secondary-50 dark:bg-secondary-100")}>
        <MoreHorizontal className={cn("w-5 h-5", isMoreActive ? "text-secondary-600 dark:text-secondary-500" : "text-primary-400 dark:text-primary-600")} strokeWidth={isMoreActive ? 2.1 : 1.8} />
      </span>
      <span className={cn("text-[10px] font-medium", isMoreActive ? "text-secondary-600 dark:text-secondary-500" : "text-primary-400 dark:text-primary-600")}>{moreLabel}</span>
    </button>
  </nav>
);

const MoreSheet = ({
  open,
  onClose,
  items,
  pathname,
  router,
  title,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
  router: ReturnType<typeof useRouter>;
  title: string;
}) => (
  <>
    <div
      onClick={onClose}
      className={cn("fixed inset-0 z-50 bg-primary-900/60 backdrop-blur-sm transition-opacity md:hidden", open ? "opacity-100" : "opacity-0 pointer-events-none")}
    />
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white dark:bg-primary-100 shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] transform transition-transform duration-300 ease-in-out md:hidden",
        open ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex justify-center pt-2.5">
        <div className="w-10 h-1 rounded-full bg-primary-200 dark:bg-primary-400" />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-base font-bold text-primary-900 dark:text-primary-900">{title}</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex items-center justify-center w-9 h-9 rounded-full transition-colors text-primary-400 hover:bg-primary-50 hover:text-primary-600 dark:text-primary-700 dark:hover:bg-primary-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pb-4">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => {
                router.push(item.href);
                onClose();
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl px-2 py-4 text-center transition-all active:scale-95",
                isActive ? "bg-primary-500 text-on-solid dark:bg-secondary-400 dark:text-on-bright" : "bg-primary-50 text-primary-700 dark:bg-primary-200 dark:text-primary-800",
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={1.9} />
              <span className="text-xs font-medium leading-tight">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  </>
);

const DashboardLayoutInner = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations("dashboard");
  const { data: session, status } = useSession();
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const prevPathnameRef = useRef(pathname);

  const isAuthenticated = !!session?.user;
  const navigation = useNavigation(session?.user?.role);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      if (moreOpen) {
        const timer = setTimeout(() => setMoreOpen(false), 0);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname, moreOpen]);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [moreOpen]);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      const reason = session && !session.user ? "?reason=password_expired" : "";
      window.location.href = `/login${reason}`;
    }
  }, [status, isAuthenticated, session]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-50 dark:bg-primary-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 rounded-full animate-spin border-primary-200 border-t-primary-500 dark:border-primary-300 dark:border-t-secondary-400 md:w-16 md:h-16" />
          <p className="text-sm text-primary-500 dark:text-primary-700 md:text-base">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-50 dark:bg-primary-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 rounded-full animate-spin border-primary-200 border-t-primary-500 dark:border-primary-300 dark:border-t-secondary-400 md:w-16 md:h-16" />
          <p className="text-sm text-primary-500 dark:text-primary-700 md:text-base">{t("redirecting")}</p>
        </div>
      </div>
    );
  }

  const currentTitle = navigation.all.find((item) => item.href === pathname)?.name ?? t("appName");
  const isMoreActive = navigation.secondary.some((item) => item.href === pathname);

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-primary-50">
      <Sidebar groups={navigation.groups} pathname={pathname} router={router} t={t} />
      <TopBar session={session as Session} router={router} logout={logout} title={currentTitle} />

      <BottomNav
        primary={navigation.primary}
        pathname={pathname}
        router={router}
        onMore={() => setMoreOpen(true)}
        moreLabel={t("nav.more")}
        isMoreActive={isMoreActive}
      />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={navigation.secondary} pathname={pathname} router={router} title={t("nav.more")} />

      <main className="min-h-screen pt-[calc(3.75rem+env(safe-area-inset-top))] pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0 md:ml-64 bg-primary-50 dark:bg-primary-50">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return <DashboardLayoutInner>{children}</DashboardLayoutInner>;
};

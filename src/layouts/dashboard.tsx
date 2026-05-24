"use client";

import { useEffect, useRef, useState } from "react";

import { useSession } from "next-auth/react";

import { useRouter as useRouterGlobal } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";

import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks";

import { Dropdown, DropdownItem, DropdownDivider, AvatarImg, Img } from "@/components";

import { formatInitialName } from "@/utils";

import { Session } from "next-auth";

interface SidebarContentProps {
  session: Session;
  router: ReturnType<typeof useRouter>;
  pathname: string;
  logout: () => void;
}

interface DropdownContentProps {
  session: Session;
  router: ReturnType<typeof useRouter>;
  logout: () => void;
  variant?: "sidebar" | "mobile-header";
}

const DropdownContent = ({ session, router, logout, variant = "sidebar" }: DropdownContentProps) => {
  const t = useTranslations("dashboard");

  const isMobileHeader = variant === "mobile-header";

  return (
    <Dropdown
      trigger={
        isMobileHeader ? (
          <button className="flex items-center transition-colors rounded-full hover:ring-2 hover:ring-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-300">
            {!session.user.avatar ? (
              <div className="flex items-center justify-center w-8 h-8 text-xs font-medium rounded-full bg-primary-100 text-primary-700">{formatInitialName(session.user.name || "")}</div>
            ) : (
              <AvatarImg src={session.user.avatar} alt="User" size="sm" />
            )}
          </button>
        ) : (
          <button className="flex items-center w-full gap-2 p-2 transition-colors rounded-lg hover:bg-primary-50 md:gap-3">
            {!session.user.avatar ? (
              <div className="flex items-center justify-center w-8 h-8 text-sm font-medium rounded-full shrink-0 bg-primary-100 text-primary-700 md:w-10 md:h-10 md:text-base">
                {formatInitialName(session.user.name || "")}
              </div>
            ) : (
              <AvatarImg src={session.user.avatar} alt="User" size="md" className="shrink-0" />
            )}
            <div className="flex flex-col flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold truncate text-primary-900 md:text-base" title={session.user.name || ""}>
                {session.user.name}
              </p>
              <p className="text-xs truncate text-primary-600" title={session.user.email}>
                {session.user.email}
              </p>
            </div>
          </button>
        )
      }
      align={isMobileHeader ? "right" : "left"}
      position={isMobileHeader ? "top-12" : "bottom-16"}
    >
      <DropdownItem icon={<span>⚙️</span>} onClick={() => router.push("/admin/dashboard/settings")}>
        {t("menu.settings")}
      </DropdownItem>
      <DropdownItem icon={<span>👤</span>} onClick={() => router.push("/admin/dashboard/profiles")}>
        {t("menu.profile")}
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem icon={<span>🚪</span>} danger onClick={() => logout()}>
        {t("menu.logout")}
      </DropdownItem>
    </Dropdown>
  );
};

const SidebarContent = ({ session, router, pathname, logout }: SidebarContentProps) => {
  const t = useTranslations("dashboard");

  const navigation = [
    { name: t("nav.dashboard"), href: "/admin/dashboard", icon: "📊" },
    { name: t("nav.transactions"), href: "/admin/dashboard/transactions", icon: "💰" },
    { name: t("nav.accounts"), href: "/admin/dashboard/accounts", icon: "💳" },
    { name: t("nav.categories"), href: "/admin/dashboard/categories", icon: "📁" },
    { name: t("nav.budgets"), href: "/admin/dashboard/budgets", icon: "📊" },
    { name: t("nav.goals"), href: "/admin/dashboard/goals", icon: "🎯" },
    { name: t("nav.reports"), href: "/admin/dashboard/reports", icon: "📈" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-primary-100 md:p-6">
        <Img src="/finarthax.png" alt="finarthax logo" width={36} height={36} objectFit="cover" priority />
        <div>
          <h1 className="text-sm font-bold text-primary-900 md:text-base">{t("appName")}</h1>
          <p className="text-xs text-primary-600">{t("appTagline")}</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto md:p-4 md:space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.name}
              onClick={() => router.push(item.href)}
              className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm md:px-4 md:py-3 md:text-base ${
                isActive ? "bg-primary text-white" : "text-primary-700 hover:bg-primary-50"
              }`}
            >
              <span className="text-lg md:text-xl">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="hidden p-3 border-t border-primary-100 md:p-4 md:block">
        <DropdownContent session={session} router={router} logout={logout} />
      </div>
    </div>
  );
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations("dashboard");
  const { data: session, status } = useSession();
  const { logout } = useAuth();
  const routerGlobal = useRouterGlobal();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      if (sidebarOpen) {
        const timer = setTimeout(() => setSidebarOpen(false), 0);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname, sidebarOpen]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (status !== "loading" && !session) {
      routerGlobal.push("/login");
    }
  }, [status, session, routerGlobal]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 rounded-full border-t-primary border-primary-200 animate-spin md:w-16 md:h-16" />
          <p className="text-sm text-primary-600 md:text-base">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 rounded-full border-t-primary border-primary-200 animate-spin md:w-16 md:h-16" />
          <p className="text-sm text-primary-600 md:text-base">{t("redirecting")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 bg-white border-b h-14 border-primary-100 md:hidden">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-primary-700 hover:bg-primary-50 transition-colors" aria-label="Open menu">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <Img src="/finarthax.png" alt="finarthax logo" width={28} height={28} objectFit="cover" priority />
          <span className="text-sm font-bold text-primary-900">{t("appName")}</span>
        </div>

        <div className="flex">
          <DropdownContent session={session} router={router} logout={logout} variant="mobile-header" />
        </div>
      </header>

      {sidebarOpen && <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out md:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <SidebarContent session={session} router={router} pathname={pathname} logout={logout} />
      </div>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 bg-white border-r border-primary-100 md:block">
        <SidebarContent session={session} router={router} pathname={pathname} logout={logout} />
      </aside>

      <main className="min-h-screen pt-14 md:pt-0 md:ml-64">
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

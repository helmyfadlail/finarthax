"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSettings } from "@/hooks";
import { isSupportedLocale } from "@/static";

export const LocaleSync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const activeLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { getUserSetting, isLoadingUserSettings } = useSettings();

  const hasApplied = React.useRef(false);
  const preferred = getUserSetting("language")?.value;

  React.useEffect(() => {
    if (hasApplied.current || isLoadingUserSettings || !preferred) return;

    hasApplied.current = true;

    if (!isSupportedLocale(preferred) || preferred === activeLocale) return;

    router.replace(pathname, { locale: preferred });
  }, [preferred, isLoadingUserSettings, activeLocale, pathname, router]);

  return <>{children}</>;
};

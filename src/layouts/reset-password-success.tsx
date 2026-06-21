"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSettings } from "@/hooks";
import { Button, Skeleton } from "@/components";

const RESET_PASSWORD_SUCCESS = "reset_password_success";
const DEFAULT_COUNTDOWN_SECONDS = 5;

export const ResetPasswordSuccess = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getAppSetting, isLoadingAppSettings } = useSettings();

  const resetPasswordSuccessData = React.useMemo(() => {
    const resolve = (key: string) => {
      const setting = getAppSetting(key);
      if (!setting) return "";
      return setting.value;
    };

    return {
      buttonText: resolve(`${RESET_PASSWORD_SUCCESS}_button_text`),
      redirectCountdownText: resolve(`${RESET_PASSWORD_SUCCESS}_redirect_countdown_text`) as string,
      redirectCountdownSeconds: resolve(`${RESET_PASSWORD_SUCCESS}_redirect_countdown_seconds`) as string,
      footerCopyright: resolve("footer_copyright"),
    };
  }, [getAppSetting]);

  const title = searchParams.get("title");
  const message = searchParams.get("message");
  const redirectUrl = searchParams.get("redirect") || "/";
  const redirectLabel = searchParams.get("redirectLabel");
  const autoRedirect = searchParams.get("autoRedirect");

  const [countdown, setCountdown] = React.useState<number>(0);

  React.useEffect(() => {
    if (isLoadingAppSettings) return;
    if (!autoRedirect) return;

    const parsedSeconds = Number(resetPasswordSuccessData.redirectCountdownSeconds);
    const seconds = Number.isFinite(parsedSeconds) && parsedSeconds > 0 ? parsedSeconds : DEFAULT_COUNTDOWN_SECONDS;

    const timeout = window.setTimeout(() => {
      setCountdown(seconds);
    }, 0);

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = redirectUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(timer);
    };
  }, [isLoadingAppSettings, autoRedirect, redirectUrl, resetPasswordSuccessData.redirectCountdownSeconds, router]);

  if (isLoadingAppSettings) {
    return (
      <div className="relative flex items-center justify-center min-h-screen px-4 py-6 overflow-hidden bg-linear-to-br from-primary via-secondary to-primary sm:px-6 md:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-40 h-40 rounded-full -left-16 top-10 bg-secondary opacity-20 blur-3xl sm:left-10 sm:top-20 sm:h-72 sm:w-72" />
          <div className="absolute w-56 h-56 rounded-full bottom-10 -right-16 bg-secondary opacity-20 blur-3xl sm:bottom-20 sm:right-10 sm:h-96 sm:w-96" />
        </div>

        <div className="relative w-full max-w-sm sm:max-w-md">
          <div className="p-5 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm sm:p-6 md:p-8">
            <div className="flex flex-col items-center text-center">
              <Skeleton className="w-16 h-16 mb-5 rounded-full sm:mb-6 sm:h-20 sm:w-20" />

              <Skeleton className="w-40 h-6 sm:h-7 sm:w-56" />

              <div className="mt-3 space-y-2">
                <Skeleton className="w-56 h-4 sm:w-72" />
                <Skeleton className="w-40 h-4 sm:w-56" />
              </div>

              <Skeleton className="w-32 h-4 mt-4" />

              <div className="flex flex-col w-full gap-3 mt-8">
                <Skeleton className="w-full h-11 rounded-lg sm:h-12" />
                <Skeleton className="w-full h-11 rounded-lg sm:h-12" />
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-6 sm:mt-8">
            <Skeleton className="h-4 w-32 opacity-60 sm:w-44" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-linear-to-br from-primary via-secondary to-primary">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full top-20 left-10 w-72 h-72 bg-secondary opacity-20 blur-3xl" />
        <div className="absolute rounded-full bottom-20 right-10 w-96 h-96 bg-secondary opacity-20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="p-8 shadow-2xl bg-white/95 backdrop-blur-sm rounded-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 bg-secondary rounded-full opacity-75 animate-ping" />
              <div className="relative flex items-center justify-center w-20 h-20 bg-primary rounded-full">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-primary-900">{title}</h2>

            <p className="mt-3 text-primary-600">{message}</p>

            {autoRedirect && countdown > 0 && <p className="mt-4 text-sm text-primary-500">{resetPasswordSuccessData.redirectCountdownText.replace("{seconds}", countdown.toString())}</p>}

            <div className="flex flex-col w-full gap-3 mt-8">
              <Link href={redirectUrl} className="w-full">
                <Button variant="primary" size="lg" className="w-full">
                  {redirectLabel}
                </Button>
              </Link>

              <Link href="/" className="w-full">
                <Button variant="outline" size="lg" className="w-full">
                  {resetPasswordSuccessData.buttonText}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm text-center text-white/80">{resetPasswordSuccessData.footerCopyright}</p>
      </div>
    </div>
  );
};

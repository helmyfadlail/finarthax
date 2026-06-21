"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth, useSettings } from "@/hooks";
import { Button, Input, Skeleton, useToast } from "@/components";

const FORGOT_PASSWORD = "forgot_password";

export const ForgotPassword = () => {
  const [email, setEmail] = React.useState<string>("");
  const [localError, setLocalError] = React.useState<string>("");

  const { addToast } = useToast();

  const { forgotPassword, isSendingForgotPassword, forgotPasswordError } = useAuth();
  const { getAppSetting, isLoadingAppSettings } = useSettings();

  const forgotPasswordData = React.useMemo(() => {
    const resolve = (key: string) => {
      const setting = getAppSetting(key);
      if (!setting) return "";
      return setting.value;
    };

    return {
      title: resolve(`${FORGOT_PASSWORD}_title`),
      description: resolve(`${FORGOT_PASSWORD}_description`),
      notice: resolve(`${FORGOT_PASSWORD}_notice`),
      button: resolve(`${FORGOT_PASSWORD}_button_text`),
      promptText: resolve(`${FORGOT_PASSWORD}_prompt_text`),
      footerCopyright: resolve("footer_copyright"),
    };
  }, [getAppSetting]);

  const handleForgotPassword = async (e: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    setLocalError("");

    if (!email.trim()) {
      setLocalError("Email is required");
      return;
    }

    forgotPassword(
      { email },
      {
        onSuccess: () => {
          addToast({ message: "Password reset link sent successfully.", type: "success" });
        },
      },
    );
  };

  const error = localError || forgotPasswordError?.message;

  if (isLoadingAppSettings) {
    return (
      <div className="relative flex items-center justify-center min-h-screen px-4 py-6 overflow-hidden bg-linear-to-br from-primary via-secondary to-primary sm:px-6 md:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-40 h-40 rounded-full -left-16 top-10 bg-secondary opacity-20 blur-3xl sm:left-10 sm:top-20 sm:h-72 sm:w-72" />
          <div className="absolute w-56 h-56 rounded-full bottom-10 -right-16 bg-secondary opacity-20 blur-3xl sm:bottom-20 sm:right-10 sm:h-96 sm:w-96" />
        </div>
        <div className="relative w-full max-w-sm sm:max-w-md">
          <div className="p-5 space-y-6 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm sm:p-6 md:p-8">
            <div className="space-y-1">
              <Skeleton className="w-32 h-6 sm:h-8 sm:w-40 md:w-80" />
              <Skeleton className="w-40 h-12 sm:w-64 md:w-90" />
            </div>
            <div className="space-y-1">
              <Skeleton className="w-20 h-4 sm:w-24" />
              <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
            </div>
            <div className="space-y-1">
              <Skeleton className="w-24 h-10 sm:w-32 md:w-90" />
              <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
            </div>
            <div className="flex justify-center mt-2 sm:mt-8">
              <Skeleton className="h-4 w-28 opacity-60 sm:w-40" />
            </div>
          </div>
          <div className="flex justify-center mt-6 sm:mt-8">
            <Skeleton className="h-4 w-28 opacity-60 sm:w-40" />
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-primary-900">{forgotPasswordData.title}</h2>
            <p className="mt-1 text-primary-500">{forgotPasswordData.description}</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-6 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
              <svg className="size-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Input
              type="email"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              required
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                  />
                </svg>
              }
            />

            <div className="pt-2 text-sm text-primary-600">
              <p>{forgotPasswordData.notice}</p>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isSendingForgotPassword}>
              {forgotPasswordData.button}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-primary-600">
            <Link href="/login" className="flex items-center justify-center gap-2 font-semibold text-primary-700 hover:text-primary-900">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {forgotPasswordData.promptText}
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-center text-white/80">{forgotPasswordData.footerCopyright}</p>
      </div>
    </div>
  );
};

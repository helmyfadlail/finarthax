"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth, useSettings } from "@/hooks";
import { Button, Input, Skeleton } from "@/components";

const RESET_PASSWORD = "reset_password";

export const ResetPassword = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { resetPassword, isResettingPassword, resetPasswordError } = useAuth();
  const { getAppSetting, isLoadingAppSettings } = useSettings();

  const [password, setPassword] = React.useState<string>("");
  const [confirmPassword, setConfirmPassword] = React.useState<string>("");
  const [localError, setLocalError] = React.useState<string>("");

  const resetPasswordData = React.useMemo(() => {
    const resolve = (key: string) => {
      const setting = getAppSetting(key);
      if (!setting) return "";
      return setting.value;
    };

    return {
      title: resolve(`${RESET_PASSWORD}_title`),
      description: resolve(`${RESET_PASSWORD}_description`),
      requirements: resolve(`${RESET_PASSWORD}_requirements`),
      requirementsList: resolve(`${RESET_PASSWORD}_requirements_list`) as string[],
      button: resolve(`${RESET_PASSWORD}_button_text`),
      promptText: resolve(`${RESET_PASSWORD}_prompt_text`),
      signinText: resolve("signin_text"),
      footerCopyright: resolve("footer_copyright"),
    };
  }, [getAppSetting]);

  const handleResetPassword = async (e: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    setLocalError("");

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters long");
      return;
    }

    if (!token) {
      setLocalError("Invalid or missing reset token");
      return;
    }

    resetPassword({ password, token });
  };

  const error = localError || resetPasswordError?.message;

  if (isLoadingAppSettings) {
    return (
      <div className="relative flex items-center justify-center min-h-screen px-4 py-6 overflow-hidden bg-linear-to-br from-primary via-secondary to-primary sm:px-6 md:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-40 h-40 rounded-full -left-16 top-10 bg-secondary opacity-20 blur-3xl sm:left-10 sm:top-20 sm:h-72 sm:w-72" />
          <div className="absolute w-56 h-56 rounded-full bottom-10 -right-16 bg-secondary opacity-20 blur-3xl sm:bottom-20 sm:right-10 sm:h-96 sm:w-96" />
        </div>
        <div className="relative w-full max-w-sm sm:max-w-md">
          <div className="p-5 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm sm:p-6 md:p-8">
            <div className="mb-5 space-y-2 sm:mb-6">
              <Skeleton className="w-32 h-6 sm:h-8 sm:w-40" />
              <Skeleton className="w-40 h-4 sm:w-64" />
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Skeleton className="w-20 h-4 sm:w-24" />
                <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
              </div>
              <div className="space-y-1">
                <Skeleton className="w-20 h-4 sm:w-24" />
                <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
              </div>
              <Skeleton className="w-full h-12 rounded-lg sm:h-16 md:h-20" />
              <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
              <div className="flex justify-center mt-5 sm:mt-6">
                <Skeleton className="h-4 w-36 sm:w-48" />
              </div>
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
            <h2 className="text-2xl font-bold text-primary-900">{resetPasswordData.title}</h2>
            <p className="mt-1 text-primary-500">{resetPasswordData.description}</p>
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

          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              type="password"
              label="New Password"
              placeholder="••••••••"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              required
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />

            <Input
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              required
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <div className="pt-2 text-sm text-primary-600">
              <p className="font-medium">{resetPasswordData.requirements}</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-primary-500">
                {resetPasswordData.requirementsList.length > 0 && resetPasswordData.requirementsList.map((requirement, index) => <li key={`${index}-${requirement}`}>{requirement}</li>)}
              </ul>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isResettingPassword}>
              {resetPasswordData.button}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-primary-600">
            {resetPasswordData.promptText}{" "}
            <Link href="/login" className="font-semibold text-primary-700 hover:text-primary-900">
              {resetPasswordData.signinText}
            </Link>
          </p>
        </div>

        <p className="mt-8 text-sm text-center text-white/80">{resetPasswordData.footerCopyright}</p>
      </div>
    </div>
  );
};

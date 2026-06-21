"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Input, Skeleton } from "@/components";
import { useAuth, useSettings } from "@/hooks";

const REGISTER = "register";

const getRequirementClass = (requirement: string, password: string) => {
  switch (requirement) {
    case "At least 8 characters":
      return password.length >= 8 ? "text-green-600" : "";

    case "One uppercase letter":
      return /[A-Z]/.test(password) ? "text-green-600" : "";

    case "One lowercase letter":
      return /[a-z]/.test(password) ? "text-green-600" : "";

    case "One number":
      return /[0-9]/.test(password) ? "text-green-600" : "";

    default:
      return "";
  }
};

export const Register = () => {
  const [name, setName] = React.useState<string>("");
  const [email, setEmail] = React.useState<string>("");
  const [password, setPassword] = React.useState<string>("");
  const [confirmPassword, setConfirmPassword] = React.useState<string>("");
  const [isAgreeToTerms, setIsAgreeToTerms] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const { register, isRegistering, registerError, loginWithGoogle } = useAuth();
  const { getAppSetting, isLoadingAppSettings } = useSettings();

  const registerData = React.useMemo(() => {
    const resolve = (key: string) => {
      const setting = getAppSetting(key);
      if (!setting) return "";
      return setting.value;
    };

    return {
      title: resolve(`${REGISTER}_title`),
      description: resolve(`${REGISTER}_description`),
      passwordRequirements: resolve(`${REGISTER}_password_requirements`),
      passwordRequirementsList: resolve(`${REGISTER}_password_requirements_list`) as string[],
      createAccountBtn: resolve(`${REGISTER}_button_create_account_text`),
      confirmationText: resolve(`${REGISTER}_confirmation_text`),
      loginPromptText: resolve(`${REGISTER}_prompt_text`),
      googleSignupBtn: resolve("google_signup_button"),
      socialLoginSeparator: resolve("social_login_separator"),
      footerCopyright: resolve("footer_copyright"),
      signinText: resolve("signin_text"),
    };
  }, [getAppSetting]);

  const handleRegister = async (e: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    setError("");

    if (isAgreeToTerms === false) {
      setError("You must agree to the terms to register");
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");

    register({ name, email, password });
  };

  const errorMessage = error || registerError?.message;

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
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="space-y-1">
                  <Skeleton className="w-20 h-4 sm:w-24" />
                  <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
                </div>
              ))}
              <Skeleton className="w-full h-24 rounded-lg sm:h-32 md:h-40" />
              <div className="flex">
                <Skeleton className="h-4 w-28 sm:w-40" />
              </div>
              <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
            </div>
            <div className="my-5 sm:my-6">
              <Skeleton className="w-full h-4" />
            </div>
            <Skeleton className="w-full h-10 rounded-lg sm:h-11 md:h-12" />
            <div className="flex justify-center mt-5 sm:mt-6">
              <Skeleton className="h-4 w-36 sm:w-48" />
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

      <div className="relative w-full max-w-sm sm:max-w-md">
        <div className="p-8 shadow-2xl bg-white/95 backdrop-blur-sm rounded-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-primary-900">{registerData.title}</h2>
            <p className="mt-1 text-primary-500">{registerData.description}</p>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 mb-6 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
              <svg className="size-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              type="text"
              label="Full name"
              placeholder="John Doe"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <Input
              type="email"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
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

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />

            <Input
              type="password"
              label="Confirm password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <div className="p-3 text-xs rounded-lg bg-primary-50 text-primary-700">
              <p className="mb-1 font-medium">{registerData.passwordRequirements}</p>
              <ul className="space-y-1 list-disc list-inside">
                {registerData.passwordRequirementsList.map((requirement, index) => (
                  <li key={`${index}-${requirement}`} className={getRequirementClass(requirement, password)}>
                    {requirement}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                id="terms"
                checked={isAgreeToTerms}
                onChange={(e) => setIsAgreeToTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-primary-300 text-primary-400 accent-primary-400 focus:ring-primary-500"
              />
              <label htmlFor="terms" className="text-primary-600">
                {registerData.confirmationText}
              </label>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isRegistering}>
              {registerData.createAccountBtn}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white rounded-2xl text-primary-500">{registerData.socialLoginSeparator}</span>
            </div>
          </div>

          <Button type="button" variant="outline" size="lg" className="w-full" onClick={loginWithGoogle} disabled={isRegistering}>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {registerData.googleSignupBtn}
          </Button>

          <p className="mt-6 text-sm text-center text-primary-600">
            {registerData.loginPromptText}{" "}
            <Link href="/login" className="font-semibold text-primary-700 hover:text-primary-900">
              {registerData.signinText}
            </Link>
          </p>
        </div>

        <p className="mt-8 text-sm text-center text-white/80">{registerData.footerCopyright}</p>
      </div>
    </div>
  );
};

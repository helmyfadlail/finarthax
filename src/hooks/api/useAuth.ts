"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signIn, signOut } from "next-auth/react";

import { useRouter } from "next/navigation";

import { apiClient } from "@/utils";

import type { ApiResponse, User } from "@/types";

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface ResetPasswordData {
  password: string;
  token: string;
}

export const useAuth = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => apiClient.post<ApiResponse<User>, RegisterData>("/auth/register", data),
    onSuccess: async (_, variables) => {
      await signIn("credentials", {
        email: variables.email,
        password: variables.password,
        redirect: false,
      });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      router.push("/admin/dashboard");
    },
  });

  const loginWithGoogle = async () => {
    await signIn("google", { callbackUrl: "/admin/dashboard" });
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await signOut({ redirect: false });
    },
    onSuccess: () => {
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
      });
      router.push("/login");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: ResetPasswordData) => apiClient.post<ApiResponse<User>, ResetPasswordData>("/auth/reset-password", data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      const successParams = new URLSearchParams({
        title: "Password Reset Successful",
        message: "Your password has been reset successfully. You can now sign in with your new password.",
        redirect: "/login",
        redirectLabel: "Sign In Now",
        autoRedirect: "true",
      });

      router.push(`/reset-password/success?${successParams.toString()}`);
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (data: { email: string }) => apiClient.post<ApiResponse<User>, { email: string }>("/auth/forgot-password", data),
  });

  return {
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    loginWithGoogle,
    resetPassword: resetPasswordMutation.mutate,
    resetPasswordAsync: resetPasswordMutation.mutateAsync,
    isResettingPassword: resetPasswordMutation.isPending,
    resetPasswordError: resetPasswordMutation.error,
    forgotPassword: forgotPasswordMutation.mutate,
    forgotPasswordAsync: forgotPasswordMutation.mutateAsync,
    isSendingForgotPassword: forgotPasswordMutation.isPending,
    forgotPasswordError: forgotPasswordMutation.error,
  };
};

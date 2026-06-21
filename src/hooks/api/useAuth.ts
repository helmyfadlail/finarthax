"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn, signOut } from "next-auth/react";
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
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => apiClient.post<ApiResponse<User>, RegisterData>("/auth/register", data),
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      await signIn("credentials", {
        email: variables.email,
        password: variables.password,
        callbackUrl: "/admin/dashboard",
      });
    },
  });

  const loginWithGoogle = async () => {
    await signIn("google", { callbackUrl: "/admin/dashboard" });
  };

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await signIn("credentials", { redirect: false, ...data });
      if (!response) throw new Error("No response received from server.");
      if (response.error) throw new Error(response.error);
      return response;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      window.location.href = "/admin/dashboard";
    },
  });

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
      window.location.href = "/login";
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: ResetPasswordData) => apiClient.post<ApiResponse<{ redirectUrl: string }>, ResetPasswordData>("/auth/reset-password", data),
    onSuccess: async ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      window.location.href = data.redirectUrl;
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (data: { email: string }) => apiClient.post<ApiResponse<User>, { email: string }>("/auth/forgot-password", data),
  });

  return {
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    loginWithGoogle,
    resetPassword: resetPasswordMutation.mutate,
    isResettingPassword: resetPasswordMutation.isPending,
    resetPasswordError: resetPasswordMutation.error,
    forgotPassword: forgotPasswordMutation.mutate,
    isSendingForgotPassword: forgotPasswordMutation.isPending,
    forgotPasswordError: forgotPasswordMutation.error,
  };
};

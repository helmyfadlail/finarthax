"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiClient } from "@/utils";
import { BASE_CURRENCY, EXCHANGE_RATE_URL } from "@/static";
import type { ApiResponse, AppSetting, UserSetting } from "@/types";

interface ExchangeRateResponse {
  rates: Record<string, number>;
}

export const useSettings = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const { data: appSettingsData, isLoading: isLoadingAppSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => apiClient.get<ApiResponse<AppSetting[]>>("/settings"),
  });

  const { data: userSettingsData, isLoading: isLoadingUserSettings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: () => apiClient.get<ApiResponse<UserSetting[]>>("/users/settings"),
    enabled: !!session?.user,
  });

  const updateNotificationMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean | string }) => apiClient.patch<ApiResponse<UserSetting>, { value: string }>(`/users/settings/${key}`, { value: String(value) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  const { data: ratesData, isLoading: isLoadingRates } = useQuery({
    queryKey: ["exchange-rates", BASE_CURRENCY],
    queryFn: async () => {
      const data = await apiClient.getExternal<ExchangeRateResponse>(`${EXCHANGE_RATE_URL}/${BASE_CURRENCY}`);

      if (!data.rates || typeof data.rates !== "object") throw new Error("Invalid response format: missing rates data");

      return data.rates;
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const blob = await apiClient.getBlob("/users/export");

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finarthax-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => apiClient.delete<ApiResponse<null>>("/users/delete"),
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const getUserSetting = React.useCallback((key: string) => userSettingsData?.data.find((s) => s.key === key), [userSettingsData]);

  const getAppSetting = React.useCallback((key: string) => appSettingsData?.data.find((s) => s.key === key), [appSettingsData]);

  return {
    userSettingsData: userSettingsData?.data || null,
    isLoadingUserSettings,
    appSettingsData: appSettingsData?.data || null,
    isLoadingAppSettings,
    exchangeRates: ratesData || null,
    isLoadingRates,
    getAppSetting,
    getUserSetting,
    updateNotification: updateNotificationMutation.mutate,
    updateNotificationAsync: updateNotificationMutation.mutateAsync,
    isUpdatingNotification: updateNotificationMutation.isPending,
    exportData: exportDataMutation.mutate,
    exportDataAsync: exportDataMutation.mutateAsync,
    isExporting: exportDataMutation.isPending,
    exportError: exportDataMutation.error,
    deleteAccount: deleteAccountMutation.mutate,
    deleteAccountAsync: deleteAccountMutation.mutateAsync,
    isDeleting: deleteAccountMutation.isPending,
    deleteError: deleteAccountMutation.error,
  };
};

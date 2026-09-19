"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiClient } from "@/utils";
import type { ApiResponse, AppSettingInput, AppSettingUpdate, ManagedAppSetting, ManagedAppSettingList } from "@/types";

interface AppSettingFilters {
  category?: string;
  search?: string;
}

const EMPTY_LIST: ManagedAppSettingList = { data: [], categories: [] };

export const useAppSettings = (filters?: AppSettingFilters) => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const isSuperAdmin = session?.user?.role === "SUPERADMIN";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["managed-app-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app-settings"] });
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["managed-app-settings", filters],
    queryFn: () =>
      apiClient.get<ApiResponse<ManagedAppSettingList>>("/app-settings", {
        params: filters as Record<string, string | undefined>,
      }),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (input: AppSettingInput) => apiClient.post<ApiResponse<ManagedAppSetting>, AppSettingInput>("/app-settings", input),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: AppSettingUpdate }) => apiClient.patch<ApiResponse<ManagedAppSetting>, AppSettingUpdate>(`/app-settings/${key}`, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => apiClient.delete<ApiResponse<{ key: string }>>(`/app-settings/${key}`),
    onSuccess: invalidate,
  });

  const list = data?.data ?? EMPTY_LIST;

  return {
    isSuperAdmin,
    settings: list.data,
    categories: list.categories,
    isLoading: isSuperAdmin && isLoading,
    error,
    refetch,
    createSetting: createMutation.mutate,
    createSettingAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateSetting: updateMutation.mutate,
    updateSettingAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteSetting: deleteMutation.mutate,
    deleteSettingAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

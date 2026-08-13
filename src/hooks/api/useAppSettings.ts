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

/**
 * The superadmin view of `app_settings`.
 *
 * Only enabled for a superadmin session: for everyone else the endpoint answers 403, and a query
 * that fires just to be refused would put a red error on a screen they are not meant to see.
 */
export const useAppSettings = (filters?: AppSettingFilters) => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const isSuperAdmin = session?.user?.role === "SUPERADMIN";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["managed-app-settings"] });
    // The public catalogue is the same table, so anything reading it - the home page copy, the
    // preference option lists - is stale the moment a row changes here.
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

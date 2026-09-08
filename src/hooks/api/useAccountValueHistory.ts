"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, AccountValueHistory } from "@/types";

interface AddValueUpdateData {
  newBalance: number;
  note?: string;
  recordedAt?: string;
}

export const useAccountValueHistory = (accountId: string | null) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["account-value-history", accountId],
    queryFn: () => apiClient.get<ApiResponse<AccountValueHistory[]>>(`/accounts/${accountId}/value-history`),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddValueUpdateData }) => apiClient.post<ApiResponse<AccountValueHistory>, AddValueUpdateData>(`/accounts/${id}/value-history`, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["account-value-history", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return {
    history: data?.data || [],
    isLoading,
    addValueUpdate: addMutation.mutate,
    addValueUpdateAsync: addMutation.mutateAsync,
    isAddingValueUpdate: addMutation.isPending,
  };
};

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, Account } from "@/types";

interface CreateAccountData {
  name: string;
  type: "CASH" | "BANK" | "EWALLET" | "CREDIT_CARD" | "INVESTMENT";
  balance?: number;
  creditLimit?: number;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export const useAccounts = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.get<ApiResponse<Account[]>>("/accounts"),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountData) => apiClient.post<ApiResponse<Account>, CreateAccountData>("/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAccountData> }) => apiClient.put<ApiResponse<Account>, Partial<CreateAccountData>>(`/accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return {
    accounts: data?.data || [],
    isLoading,
    error,
    createAccount: createMutation.mutate,
    createAccountAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateAccount: updateMutation.mutate,
    updateAccountAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteAccount: deleteMutation.mutate,
    deleteAccountAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

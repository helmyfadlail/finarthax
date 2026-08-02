"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, Transaction, QuickTransactionData, QuickTransactionResources } from "@/types";

export const useQuickTransactions = () => {
  const searchEmailMutation = useMutation({
    mutationFn: (email: string) => apiClient.get<ApiResponse<QuickTransactionResources>>(`/quick-transactions?email=${encodeURIComponent(email)}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: QuickTransactionData) => apiClient.post<ApiResponse<Transaction>, QuickTransactionData>("/quick-transactions", data),
  });

  return {
    searchEmail: searchEmailMutation.mutate,
    searchEmailAsync: searchEmailMutation.mutateAsync,
    isSearchingEmail: searchEmailMutation.isPending,
    isSuccess: searchEmailMutation.isSuccess,
    createTransaction: createMutation.mutate,
    createTransactionAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    createSuccess: createMutation.isSuccess,
  };
};

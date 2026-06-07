"use client";

import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/utils";

import type { ApiResponse, Category, Account, Transaction, QuickTransactionData } from "@/types";

interface QuickTransactionResources {
  email: string;
  name: string;
  categories: Category[];
  accounts: Account[];
}

export const useQuickTransactions = () => {
  const searchEmailMutation = useMutation({
    mutationFn: (email: string) => apiClient.get<ApiResponse<QuickTransactionResources>>(`/quick-transactions?email=${email}`),
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

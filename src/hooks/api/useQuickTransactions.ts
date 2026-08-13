"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, Transaction, QuickRecurringActionData, QuickTransactionData, QuickTransactionResources } from "@/types";

export const useQuickTransactions = () => {
  const searchEmailMutation = useMutation({
    mutationFn: (email: string) => apiClient.get<ApiResponse<QuickTransactionResources>>(`/quick-transactions?email=${encodeURIComponent(email)}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: QuickTransactionData) => apiClient.post<ApiResponse<Transaction>, QuickTransactionData>("/quick-transactions", data),
  });

  // Logging a due occurrence and tracking a series - the same two actions the dashboard's recurring
  // screen offers, for a visitor who has only verified their email.
  const recurringMutation = useMutation({
    mutationFn: (data: QuickRecurringActionData) => apiClient.post<ApiResponse<Transaction>, QuickRecurringActionData>("/quick-transactions/recurring", data),
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
    runRecurringAction: recurringMutation.mutate,
    runRecurringActionAsync: recurringMutation.mutateAsync,
    isRunningRecurringAction: recurringMutation.isPending,
  };
};

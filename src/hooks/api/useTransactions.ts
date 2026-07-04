"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, Transaction, TransactionFilter, PaginatedResponse } from "@/types/api";

interface CreateTransactionData {
  accountId: string;
  categoryId?: string | null;
  toAccountId?: string | null;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  description?: string;
  date: string;
  attachment?: string;
}

export const useTransactions = (filters?: TransactionFilter) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () =>
      apiClient.get<ApiResponse<PaginatedResponse<Transaction>>>("/transactions", {
        params: filters as Record<string, string | number | boolean | undefined>,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTransactionData) => apiClient.post<ApiResponse<Transaction>, CreateTransactionData>("/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionData> }) => apiClient.put<ApiResponse<Transaction>, Partial<CreateTransactionData>>(`/transactions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return {
    transactions: data?.data.data || [],
    pagination: data?.data.pagination,
    isLoading,
    error,
    createTransaction: createMutation.mutate,
    createTransactionAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTransaction: updateMutation.mutate,
    updateTransactionAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTransaction: deleteMutation.mutate,
    deleteTransactionAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

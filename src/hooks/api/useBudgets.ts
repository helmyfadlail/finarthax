"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/utils";

import type { ApiResponse, Budget, PaginatedResponse } from "@/types";

interface CreateBudgetData {
  categoryId: string;
  amount: number;
  month: number;
  year: number;
}

interface UpdateBudgetData {
  amount: number;
}

interface BudgetsParams {
  month?: number;
  year?: number;
  page?: number;
  limit?: number;
  categoryId?: string;
}

export const useBudgets = (params?: BudgetsParams) => {
  const queryClient = useQueryClient();

  const now = new Date();
  const currentMonth = params?.month || now.getMonth() + 1;
  const currentYear = params?.year || now.getFullYear();
  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const categoryId = params?.categoryId || "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["budgets", currentMonth, currentYear, page, limit, categoryId],
    queryFn: () =>
      apiClient.get<ApiResponse<PaginatedResponse<Budget>>>("/budgets", {
        params: {
          month: currentMonth,
          year: currentYear,
          page,
          limit,
          categoryId: categoryId || undefined,
        },
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateBudgetData) => apiClient.post<ApiResponse<Budget>, CreateBudgetData>("/budgets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBudgetData }) => apiClient.put<ApiResponse<Budget>, UpdateBudgetData>(`/budgets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return {
    budgets: data?.data.data || [],
    pagination: data?.data.pagination,
    isLoading,
    error,
    createBudget: createMutation.mutate,
    createBudgetAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateBudget: updateMutation.mutate,
    updateBudgetAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteBudget: deleteMutation.mutate,
    deleteBudgetAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

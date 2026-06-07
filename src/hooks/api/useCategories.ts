"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/utils";

import type { ApiResponse, Category } from "@/types";

interface CreateCategoryData {
  name: string;
  type: "INCOME" | "EXPENSE";
  icon?: string;
  color?: string;
}

export const useCategories = (type?: "INCOME" | "EXPENSE") => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["categories", type],
    queryFn: () =>
      apiClient.get<ApiResponse<Category[]>>("/categories", {
        params: type ? { type } : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryData) => apiClient.post<ApiResponse<Category>, CreateCategoryData>("/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCategoryData> }) => apiClient.put<ApiResponse<Category>, Partial<CreateCategoryData>>(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  return {
    categories: data?.data || [],
    isLoading,
    error,
    createCategory: createMutation.mutate,
    createCategoryAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateCategory: updateMutation.mutate,
    updateCategoryAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteCategory: deleteMutation.mutate,
    deleteCategoryAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

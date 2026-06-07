"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/utils";

import type { ApiResponse, Goal } from "@/types";

interface CreateGoalData {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
}

export const useGoals = (status?: "ACTIVE" | "COMPLETED" | "CANCELLED") => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["goals", status],
    queryFn: () =>
      apiClient.get<ApiResponse<Goal[]>>("/goals", {
        params: status ? { status } : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateGoalData) => apiClient.post<ApiResponse<Goal>, CreateGoalData>("/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGoalData> }) => apiClient.put<ApiResponse<Goal>, Partial<CreateGoalData>>(`/goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ id, currentAmount }: { id: string; currentAmount: number }) => apiClient.patch<ApiResponse<Goal>, { currentAmount: number }>(`/goals/${id}/progress`, { currentAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  return {
    goals: data?.data || [],
    isLoading,
    error,
    createGoal: createMutation.mutate,
    createGoalAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateGoal: updateMutation.mutate,
    updateGoalAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateProgress: updateProgressMutation.mutate,
    updateProgressAsync: updateProgressMutation.mutateAsync,
    isUpdatingProgress: updateProgressMutation.isPending,
    deleteGoal: deleteMutation.mutate,
    deleteGoalAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

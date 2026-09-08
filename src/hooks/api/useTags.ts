"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, Tag } from "@/types";

interface CreateTagData {
  name: string;
  color?: string;
}

export const useTags = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiClient.get<ApiResponse<Tag[]>>("/tags"),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTagData) => apiClient.post<ApiResponse<Tag>, CreateTagData>("/tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTagData> }) => apiClient.put<ApiResponse<Tag>, Partial<CreateTagData>>(`/tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  return {
    tags: data?.data || [],
    isLoading,
    error,
    createTag: createMutation.mutate,
    createTagAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTag: updateMutation.mutate,
    updateTagAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTag: deleteMutation.mutate,
    deleteTagAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

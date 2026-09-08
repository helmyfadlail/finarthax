"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, Notification } from "@/types";

interface NotificationListResponse {
  data: Notification[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** No websocket infra in this app - a light poll keeps the bell's unread count close to real-time. */
const POLL_INTERVAL_MS = 30_000;

export const useNotifications = (options?: { unreadOnly?: boolean; limit?: number }) => {
  const queryClient = useQueryClient();
  const limit = options?.limit ?? 20;

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", options?.unreadOnly, limit],
    queryFn: () => apiClient.get<ApiResponse<NotificationListResponse>>("/notifications", { params: { unreadOnly: options?.unreadOnly, limit } }),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch<ApiResponse<Notification>, Record<string, never>>(`/notifications/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.patch<ApiResponse<null>, Record<string, never>>("/notifications/mark-all-read", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: data?.data.data || [],
    unreadCount: data?.data.unreadCount || 0,
    pagination: data?.data.pagination,
    isLoading,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
    isMarkingAllRead: markAllReadMutation.isPending,
    deleteNotification: deleteMutation.mutate,
  };
};

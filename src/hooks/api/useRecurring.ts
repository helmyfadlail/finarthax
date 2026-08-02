"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, RecurrenceInterval, RecurringFilter, RecurringOverview, Transaction } from "@/types/api";

interface TrackRecurringData {
  isRecurring: boolean;
  interval?: RecurrenceInterval | null;
  endDate?: string | null;
}

interface ConfirmRecurringData {
  amount?: number;
  date?: string;
  description?: string;
  interval?: RecurrenceInterval;
  keepTracking?: boolean;
}

const EMPTY_OVERVIEW: RecurringOverview = {
  summary: { dueCount: 0, upcomingCount: 0, detectedCount: 0, trackedCount: 0, monthlyCommitted: 0, monthlyPotential: 0 },
  due: [],
  upcoming: [],
  detected: [],
  dismissed: [],
};

export const useRecurring = (filters?: RecurringFilter) => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["recurring"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recurring", filters],
    queryFn: () =>
      apiClient.get<ApiResponse<RecurringOverview>>("/recurring", {
        params: filters as Record<string, string | number | boolean | undefined>,
      }),
  });

  const trackMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TrackRecurringData }) => apiClient.patch<ApiResponse<Transaction>, TrackRecurringData>(`/recurring/${id}`, data),
    onSuccess: invalidate,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ConfirmRecurringData }) => apiClient.post<ApiResponse<Transaction>, ConfirmRecurringData>(`/recurring/${id}/confirm`, data ?? {}),
    onSuccess: invalidate,
  });

  const skipMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<ApiResponse<Transaction>, Record<string, never>>(`/recurring/${id}/skip`, {}),
    onSuccess: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<ApiResponse<{ affected: number }>, Record<string, never>>(`/recurring/${id}/dismiss`, {}),
    onSuccess: invalidate,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<ApiResponse<{ affected: number }>>(`/recurring/${id}/dismiss`),
    onSuccess: invalidate,
  });

  const overview = data?.data ?? EMPTY_OVERVIEW;

  return {
    overview,
    summary: overview.summary,
    due: overview.due,
    upcoming: overview.upcoming,
    detected: overview.detected,
    dismissed: overview.dismissed,
    isLoading,
    error,
    refetch,
    trackRecurring: trackMutation.mutate,
    trackRecurringAsync: trackMutation.mutateAsync,
    isTracking: trackMutation.isPending,
    confirmRecurring: confirmMutation.mutate,
    confirmRecurringAsync: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,
    skipRecurring: skipMutation.mutate,
    isSkipping: skipMutation.isPending,
    dismissRecurring: dismissMutation.mutate,
    isDismissing: dismissMutation.isPending,
    restoreRecurring: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
  };
};

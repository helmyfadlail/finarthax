"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/utils";
import type { ApiResponse, AuditLog, AuditLogFilter, PaginatedResponse } from "@/types";

export const useAuditLog = (filters: AuditLogFilter) => {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", filters],
    queryFn: () => apiClient.get<ApiResponse<PaginatedResponse<AuditLog>>>("/audit-log", { params: filters as Record<string, string | number | boolean | undefined> }),
  });

  return {
    logs: data?.data.data || [],
    pagination: data?.data.pagination,
    isLoading,
  };
};

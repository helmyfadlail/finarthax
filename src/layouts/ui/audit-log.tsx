"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useAuditLog, useSearchPagination } from "@/hooks";
import { Card, CardContent, Button, Select, Badge, Skeleton } from "@/components";
import type { AuditLog, AuditEntityType, SelectOption } from "@/types";

const FILTER_NAMES = ["entityType", "startDate", "endDate"] as const;

const ENTITY_ICONS: Record<AuditEntityType, string> = {
  account: "💳",
  transaction: "💰",
  budget: "📊",
  goal: "🎯",
};

const ACTION_VARIANT: Record<AuditLog["action"], "success" | "info" | "error"> = {
  create: "success",
  update: "info",
  delete: "error",
};

const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
};

const ChangeSummary: React.FC<{ log: AuditLog }> = ({ log }) => {
  const t = useTranslations("auditLogPage");

  if (log.action === "create" && log.newValue) {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-primary-600 dark:text-primary-700">
        {Object.entries(log.newValue).map(([key, value]) => (
          <span key={key}>
            <span className="text-primary-400 dark:text-primary-600">{key}:</span> {formatFieldValue(value)}
          </span>
        ))}
      </div>
    );
  }

  if (log.action === "delete" && log.previousValue) {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-primary-600 dark:text-primary-700">
        {Object.entries(log.previousValue).map(([key, value]) => (
          <span key={key}>
            <span className="text-primary-400 dark:text-primary-600">{key}:</span> {formatFieldValue(value)}
          </span>
        ))}
      </div>
    );
  }

  if (log.action === "update" && log.previousValue && log.newValue) {
    const changedKeys = Object.keys(log.newValue).filter((key) => JSON.stringify(log.newValue?.[key]) !== JSON.stringify(log.previousValue?.[key]));

    if (changedKeys.length === 0) return <p className="text-xs sm:text-sm text-primary-400 dark:text-primary-600">{t("noFieldChanges")}</p>;

    return (
      <div className="flex flex-col gap-1 text-xs sm:text-sm text-primary-600 dark:text-primary-700">
        {changedKeys.map((key) => (
          <span key={key}>
            <span className="text-primary-400 dark:text-primary-600">{key}:</span> {formatFieldValue(log.previousValue?.[key])} → {formatFieldValue(log.newValue?.[key])}
          </span>
        ))}
      </div>
    );
  }

  return null;
};

const AuditLogItem: React.FC<{ log: AuditLog }> = ({ log }) => {
  const t = useTranslations("auditLogPage");

  return (
    <Card className="dark:bg-primary-200 dark:border-primary-400">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start flex-1 min-w-0 gap-2.5 sm:gap-3">
            <span className="text-xl sm:text-2xl shrink-0">{ENTITY_ICONS[log.entityType]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant={ACTION_VARIANT[log.action]}>{t(`actions.${log.action}`)}</Badge>
                <span className="text-sm font-medium capitalize text-primary-900 dark:text-primary-900">{t(`entities.${log.entityType}`)}</span>
              </div>
              <ChangeSummary log={log} />
            </div>
          </div>
          <span className="text-xs shrink-0 text-primary-400 dark:text-primary-600 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState: React.FC = () => {
  const t = useTranslations("auditLogPage");
  return (
    <Card className="dark:bg-primary-200 dark:border-primary-400">
      <CardContent className="pt-4 sm:pt-6">
        <div className="py-10 text-center sm:py-16">
          <div className="mb-3 text-4xl sm:mb-4 sm:text-6xl">📜</div>
          <h3 className="mb-1.5 text-lg font-bold sm:mb-2 sm:text-xl text-primary-900 dark:text-primary-900">{t("empty.title")}</h3>
          <p className="max-w-xs mx-auto text-sm sm:max-w-md text-primary-500 dark:text-primary-700">{t("empty.description")}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-3 sm:space-y-4">
    <Skeleton className="w-40 h-7 sm:w-64 sm:h-8" />
    {[1, 2, 3, 4].map((i) => (
      <Skeleton key={i} className="h-20 sm:h-24" />
    ))}
  </div>
);

export const ActivityLog: React.FC = () => {
  const t = useTranslations("auditLogPage");

  const {
    currentPage,
    handlePageChange,
    filters: { entityType, startDate, endDate },
    handleFilterChange,
  } = useSearchPagination({ defaultPage: 1, filterParamNames: FILTER_NAMES });

  const { logs, pagination, isLoading } = useAuditLog({
    entityType: (entityType || undefined) as AuditEntityType | undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page: currentPage,
    limit: 20,
  });

  const entityOptions: SelectOption[] = [
    { value: "", label: t("filter.allEntities") },
    { value: "account", label: t("entities.account") },
    { value: "transaction", label: t("entities.transaction") },
    { value: "budget", label: t("entities.budget") },
    { value: "goal", label: t("entities.goal") },
  ];

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900 dark:text-primary-900">{t("title")}</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("subtitle")}</p>
      </div>

      <Card className="dark:bg-primary-200 dark:border-primary-400">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <Select label={t("filter.entityType")} options={entityOptions} value={entityType} onChange={(e) => handleFilterChange("entityType", e.target.value)} />
            <div>
              <label className="block mb-1.5 text-xs sm:text-sm font-medium text-primary-900 dark:text-primary-900">{t("filter.startDate")}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg border-primary-200 dark:border-primary-400 bg-white dark:bg-primary-100 text-primary-900 dark:text-primary-900"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs sm:text-sm font-medium text-primary-900 dark:text-primary-900">{t("filter.endDate")}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg border-primary-200 dark:border-primary-400 bg-white dark:bg-primary-100 text-primary-900 dark:text-primary-900"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2 sm:space-y-3">
        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {logs.map((log) => (
              <AuditLogItem key={log.id} log={log} />
            ))}

            {pagination && pagination.totalPages > 1 && (
              <Card className="dark:bg-primary-200 dark:border-primary-400">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="text-xs sm:text-sm">
                      ← {t("pagination.previous")}
                    </Button>
                    <span className="px-1 text-xs sm:px-2 sm:text-sm text-primary-500 dark:text-primary-700">
                      {t("pagination.page")} <strong className="text-primary-900 dark:text-primary-900">{pagination.page}</strong> {t("pagination.of")}{" "}
                      <strong className="text-primary-900 dark:text-primary-900">{pagination.totalPages}</strong>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pagination.totalPages} className="text-xs sm:text-sm">
                      {t("pagination.next")} →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

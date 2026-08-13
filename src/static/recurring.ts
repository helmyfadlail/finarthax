import type { RecurrenceInterval } from "@/types/api";

export const RECURRENCE_INTERVALS: readonly RecurrenceInterval[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"];

export const RECURRENCE_DAYS: Record<RecurrenceInterval, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  YEARLY: 365,
};

/**
 * Plain-English interval names, for the surfaces that render outside next-intl - the public
 * quick-entry page has no locale of its own to translate against.
 */
export const RECURRENCE_LABELS: Record<RecurrenceInterval, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const RECURRENCE_ICONS: Record<RecurrenceInterval, string> = {
  DAILY: "☀️",
  WEEKLY: "🗓️",
  BIWEEKLY: "📆",
  MONTHLY: "🔁",
  YEARLY: "🎂",
};

export const RECURRENCE_STATUS_ICONS = {
  OVERDUE: "⏰",
  DUE_TODAY: "🔔",
  UPCOMING: "📅",
};

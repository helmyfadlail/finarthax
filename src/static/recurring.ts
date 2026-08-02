import type { RecurrenceInterval } from "@/types/api";

export const RECURRENCE_INTERVALS: readonly RecurrenceInterval[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"];

export const RECURRENCE_DAYS: Record<RecurrenceInterval, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  YEARLY: 365,
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

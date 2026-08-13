import { prisma } from "@/lib";
import { APP_SETTINGS, TUNING_SETTINGS } from "@/static";
import { logger } from "./logger";

/**
 * The numbers the server behaves by, read from `app_settings` with the catalogue in
 * src/static/app-settings.ts as the fallback.
 *
 * Nothing in a feature should carry its own constant: change a row in the database and the next
 * request picks it up, without a redeploy and without hunting through the code for the value.
 */
export interface Tuning {
  /** How far back the recurring detector reads. */
  recurringHistoryDays: number;
  /** Repeats needed before a pattern is suggested. */
  recurringMinOccurrences: number;
  /** Share of gaps (0-1) that must match the interval. */
  recurringMinConsistency: number;
  /** Confidence (0-100) below which a pattern is discarded. */
  recurringMinConfidence: number;
  /** Transactions inside the same bucket count as the same daily slot. */
  recurringTimeBucketMinutes: number;
  /** Most due items listed in one reminder email. */
  recurringDueEmailLimit: number;
  /** Days covered by the weekly summary email. */
  weeklyReportDays: number;
  quickLookupRateLimit: number;
  quickCreateRateLimit: number;
  quickRateLimitWindowSeconds: number;
}

const KEYS: Record<keyof Tuning, string> = {
  recurringHistoryDays: "recurring_history_days",
  recurringMinOccurrences: "recurring_min_occurrences",
  recurringMinConsistency: "recurring_min_consistency",
  recurringMinConfidence: "recurring_min_confidence",
  recurringTimeBucketMinutes: "recurring_time_bucket_minutes",
  recurringDueEmailLimit: "recurring_due_email_limit",
  weeklyReportDays: "weekly_report_days",
  quickLookupRateLimit: "quick_lookup_rate_limit",
  quickCreateRateLimit: "quick_create_rate_limit",
  quickRateLimitWindowSeconds: "quick_rate_limit_window_seconds",
};

const CATALOGUE_DEFAULTS = Object.fromEntries(TUNING_SETTINGS.map((setting) => [setting.key, setting.value]));

/** The catalogue values, used before the database is reachable or seeded. */
export const TUNING_FALLBACK: Tuning = Object.fromEntries(Object.entries(KEYS).map(([field, key]) => [field, Number(CATALOGUE_DEFAULTS[key])])) as unknown as Tuning;

const CACHE_TTL_MS = 60_000;

let cache: { value: Tuning; readAt: number } | null = null;

/**
 * Cached for a minute: these are read on hot paths and change about once a year, so hitting the
 * database on every request would buy nothing.
 */
export const getTuning = async (): Promise<Tuning> => {
  if (cache && Date.now() - cache.readAt < CACHE_TTL_MS) return cache.value;

  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.values(KEYS) } }, select: { key: true, value: true } });

    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    const value = Object.fromEntries(
      Object.entries(KEYS).map(([field, key]) => {
        const parsed = Number(stored[key]);
        return [field, Number.isFinite(parsed) ? parsed : Number(CATALOGUE_DEFAULTS[key])];
      }),
    ) as unknown as Tuning;

    cache = { value, readAt: Date.now() };
    return value;
  } catch {
    // A tuning read must never be the reason a request fails.
    return TUNING_FALLBACK;
  }
};

/** Drops the cache so a change takes effect immediately, rather than within the minute. */
export const clearTuningCache = (): void => {
  cache = null;
};

/** Keys the seed owns. They can be retuned, but not deleted - a feature reads each one by name. */
export const CATALOGUE_KEYS: ReadonlySet<string> = new Set(APP_SETTINGS.map((setting) => setting.key));

export const isCatalogueKey = (key: string): boolean => CATALOGUE_KEYS.has(key);

interface AuditEntry {
  key: string;
  action: "create" | "update" | "delete";
  previousValue?: string | null;
  newValue?: string | null;
  actor: { id: string; email: string };
}

/**
 * Records who changed a setting and what it held before.
 *
 * These rows are the behaviour of the whole instance, changed from a screen rather than a
 * redeploy, so `git log` cannot answer "who set this to 0" - this table is what answers it.
 * A failure to write the audit must not fail the change itself; it is logged and dropped.
 */
export const recordAppSettingAudit = async ({ key, action, previousValue = null, newValue = null, actor }: AuditEntry): Promise<void> => {
  try {
    await prisma.appSettingAudit.create({
      data: { key, action, previousValue, newValue, actorId: actor.id, actorEmail: actor.email },
    });
  } catch (error) {
    logger.error("app_settings.audit_failed", { key, action, err: error });
  }
};

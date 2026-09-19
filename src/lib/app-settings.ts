import { prisma } from "@/lib";
import { APP_SETTINGS, TUNING_SETTINGS } from "@/static";
import { logger } from "./logger";

interface Tuning {
  recurringHistoryDays: number;
  recurringMinOccurrences: number;
  recurringMinConsistency: number;
  recurringMinConfidence: number;
  recurringTimeBucketMinutes: number;
  recurringDueEmailLimit: number;
  weeklyReportDays: number;
  quickLookupRateLimit: number;
  quickCreateRateLimit: number;
  quickRateLimitWindowSeconds: number;
}

interface AuditEntry {
  key: string;
  action: "create" | "update" | "delete";
  previousValue?: string | null;
  newValue?: string | null;
  actor: { id: string; email: string };
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

const TUNING_FALLBACK: Tuning = Object.fromEntries(Object.entries(KEYS).map(([field, key]) => [field, Number(CATALOGUE_DEFAULTS[key])])) as unknown as Tuning;

const CACHE_TTL_MS = process.env.NODE_ENV === "production" ? Number(process.env.APP_SETTINGS_CACHE_TTL_MS) : 0;

let cache: { value: Tuning; readAt: number } | null = null;

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
    return TUNING_FALLBACK;
  }
};

export const clearTuningCache = (): void => {
  cache = null;
};

export const CATALOGUE_KEYS: ReadonlySet<string> = new Set(APP_SETTINGS.map((setting) => setting.key));

export const isCatalogueKey = (key: string): boolean => CATALOGUE_KEYS.has(key);

export const recordAppSettingAudit = async ({ key, action, previousValue = null, newValue = null, actor }: AuditEntry): Promise<void> => {
  try {
    await prisma.appSettingAudit.create({
      data: { key, action, previousValue, newValue, actorId: actor.id, actorEmail: actor.email },
    });
  } catch (error) {
    logger.error("app_settings.audit_failed", { key, action, err: error });
  }
};

import { prisma } from "@/lib";
// Imported from the module rather than the barrel: going through @/lib forms a cycle that
// collapses getTuning's inferred return type.
import { getTuning } from "./app-settings";
import type { DetectedPattern, RecurrenceInterval, RecurrenceStatus } from "@/types";
import { RECURRENCE_DAYS } from "@/static";

const GAP_RANGES: Array<{ interval: RecurrenceInterval; min: number; max: number }> = [
  { interval: "DAILY", min: 1, max: 1.5 },
  { interval: "WEEKLY", min: 6, max: 8 },
  { interval: "BIWEEKLY", min: 13, max: 16 },
  { interval: "MONTHLY", min: 27, max: 32 },
  { interval: "YEARLY", min: 355, max: 375 },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Only the lookahead is left here, and only as a last resort: everything else comes from
 * `getTuning()` so an instance can retune the detector from the database. The lookahead itself is
 * a per-account preference (`recurringLookaheadDays`).
 */
export const DETECTION_DEFAULTS = {
  lookaheadDays: 14,
};

interface DetectableTransaction {
  id: string;
  type: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string | null;
  amount: number;
  date: Date;
  recurrenceKey: string | null;
  recurrenceDismissedAt: Date | null;
}

export const startOfDay = (value: Date | string): Date => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export const diffInDays = (from: Date | string, to: Date | string): number => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);

const addMonths = (date: Date, months: number): Date => {
  const dayOfMonth = date.getUTCDate();
  const shifted = new Date(date.getTime());

  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);

  const daysInTargetMonth = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(dayOfMonth, daysInTargetMonth));

  return shifted;
};

export const addRecurrence = (date: Date | string, interval: RecurrenceInterval, count = 1): Date => {
  const base = new Date(date);

  switch (interval) {
    case "MONTHLY":
      return addMonths(base, count);
    case "YEARLY":
      return addMonths(base, 12 * count);
    default: {
      const next = new Date(base.getTime());
      next.setUTCDate(next.getUTCDate() + RECURRENCE_DAYS[interval] * count);
      return next;
    }
  }
};

export const advanceToFuture = (date: Date | string, interval: RecurrenceInterval, reference: Date = new Date()): Date => {
  let next = addRecurrence(date, interval);
  let guard = 0;

  while (diffInDays(next, reference) > 0 && guard < 500) {
    next = addRecurrence(next, interval);
    guard += 1;
  }

  return next;
};

export const resolveStatus = (nextOccurrence: Date | string, reference: Date = new Date()): RecurrenceStatus => {
  const days = diffInDays(reference, nextOccurrence);
  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE_TODAY";
  return "UPCOMING";
};

export const monthlyEquivalent = (amount: number, interval: RecurrenceInterval): number => (amount * 30.44) / RECURRENCE_DAYS[interval];

export const normalizeDescription = (description?: string | null): string => {
  const normalized = (description ?? "")
    .toLowerCase()
    .replace(/[0-9]+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "untitled";
};

/**
 * Which slot of the day a transaction falls in.
 *
 * This is what lets the same habit run twice a day: a coffee at 08:00 and another at 20:00 are the
 * same description, account and category, so without a time component they would collapse into one
 * pattern with 12-hour gaps and be detected as neither. Bucketing keeps them apart as two daily
 * series, while still tolerating that you do not buy it at exactly 08:00 every morning.
 */
export const timeSlot = (value: Date | string, bucketMinutes: number): number => {
  if (bucketMinutes <= 0) return 0;

  const date = new Date(value);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();

  return Math.floor(minutes / bucketMinutes);
};

export const buildPatternKey = (transaction: Pick<DetectableTransaction, "type" | "accountId" | "toAccountId" | "categoryId" | "description" | "date">, bucketMinutes: number): string =>
  [
    transaction.type,
    transaction.accountId,
    transaction.toAccountId ?? "-",
    transaction.categoryId ?? "-",
    normalizeDescription(transaction.description),
    `slot${timeSlot(transaction.date, bucketMinutes)}`,
  ].join("::");

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const matchInterval = (gapInDays: number): RecurrenceInterval | null => GAP_RANGES.find(({ min, max }) => gapInDays >= min && gapInDays <= max)?.interval ?? null;

/**
 * One occurrence per day *per time slot*.
 *
 * Two coffees bought within the same slot are still one habit, but a morning and an evening one are
 * two — which is the whole point of running a series twice a day. Grouping already separates the
 * slots, so this only collapses genuine duplicates inside one of them.
 */
const dedupeByDaySlot = (transactions: DetectableTransaction[], bucketMinutes: number): DetectableTransaction[] => {
  const seen = new Map<string, DetectableTransaction>();

  for (const transaction of transactions) {
    const key = `${startOfDay(transaction.date).getTime()}:${timeSlot(transaction.date, bucketMinutes)}`;
    const existing = seen.get(key);
    if (!existing || new Date(transaction.date) > new Date(existing.date)) seen.set(key, transaction);
  }

  return [...seen.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const scoreConfidence = (consistency: number, occurrences: number, amounts: number[]): number => {
  const average = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
  const deviation = average === 0 ? 0 : amounts.reduce((sum, value) => sum + Math.abs(value - average), 0) / amounts.length / average;
  const amountStability = Math.max(0, 1 - deviation);
  const repetition = Math.min(1, (occurrences - 2) / 4);

  return Math.round(consistency * 60 + repetition * 25 + amountStability * 15);
};

interface DetectionOptions {
  minOccurrences: number;
  minConsistency: number;
  minConfidence: number;
  /** Width of a daily slot; see `timeSlot`. */
  timeBucketMinutes: number;
  reference?: Date;
}

export const detectRecurringPatterns = (transactions: DetectableTransaction[], options: DetectionOptions): DetectedPattern[] => {
  const { minOccurrences, minConsistency, minConfidence, timeBucketMinutes, reference = new Date() } = options;

  const groups = new Map<string, DetectableTransaction[]>();

  for (const transaction of transactions) {
    if (transaction.recurrenceKey) continue;
    const key = buildPatternKey(transaction, timeBucketMinutes);
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  const patterns: DetectedPattern[] = [];

  for (const [patternKey, group] of groups) {
    const occurrences = dedupeByDaySlot(group, timeBucketMinutes);
    if (occurrences.length < minOccurrences) continue;

    const latest = occurrences[occurrences.length - 1];
    const isDismissed = occurrences.some((transaction) => transaction.recurrenceDismissedAt !== null);

    const gaps = occurrences.slice(1).map((transaction, index) => diffInDays(occurrences[index].date, transaction.date));
    const interval = matchInterval(median(gaps));
    if (!interval) continue;

    const nominal = RECURRENCE_DAYS[interval];
    const tolerance = Math.max(1, nominal * 0.25);
    const consistency = gaps.filter((gap) => Math.abs(gap - nominal) <= tolerance).length / gaps.length;
    if (consistency < minConsistency) continue;

    const amounts = occurrences.map((transaction) => transaction.amount);
    const confidence = scoreConfidence(consistency, occurrences.length, amounts);
    if (confidence < minConfidence) continue;

    const averageAmount = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
    const nextDate = advanceToFuture(latest.date, interval, reference);

    patterns.push({
      patternKey,
      transactionId: latest.id,
      type: latest.type as DetectedPattern["type"],
      accountId: latest.accountId,
      toAccountId: latest.toAccountId,
      categoryId: latest.categoryId,
      description: latest.description ?? null,
      interval,
      occurrences: occurrences.length,
      averageAmount: Math.round(averageAmount * 100) / 100,
      lastAmount: latest.amount,
      lastDate: new Date(latest.date).toISOString(),
      nextDate: nextDate.toISOString(),
      confidence,
      monthlyEstimate: Math.round(monthlyEquivalent(averageAmount, interval) * 100) / 100,
      dismissed: isDismissed,
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence || new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
};

/**
 * Every transaction that belongs to the same series as `transaction`, itself included.
 *
 * Matching includes the time slot, so tracking or dismissing the morning habit leaves the evening
 * one alone even though they share a description, account and category.
 */
export const findSeriesSiblings = async (
  userId: string,
  transaction: Pick<DetectableTransaction, "id" | "type" | "accountId" | "toAccountId" | "categoryId" | "description" | "date">,
  options?: { historyDays: number; timeBucketMinutes: number },
) => {
  // Resolved here rather than at each call site, so no caller can forget the time bucket and
  // silently merge two series that only differ by time of day.
  const tuning = await getTuning();
  const historyDays = options?.historyDays ?? tuning.recurringHistoryDays;
  const timeBucketMinutes = options?.timeBucketMinutes ?? tuning.recurringTimeBucketMinutes;

  const since = new Date(Date.now() - historyDays * MS_PER_DAY);

  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      type: transaction.type as "INCOME" | "EXPENSE" | "TRANSFER",
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
      categoryId: transaction.categoryId,
      date: { gte: since },
    },
    select: { id: true, date: true, description: true },
    orderBy: { date: "asc" },
  });

  const seriesDescription = normalizeDescription(transaction.description);
  const seriesSlot = timeSlot(transaction.date, timeBucketMinutes);

  const siblings = candidates.filter((candidate) => normalizeDescription(candidate.description) === seriesDescription && timeSlot(candidate.date, timeBucketMinutes) === seriesSlot);

  if (!siblings.some((sibling) => sibling.id === transaction.id)) {
    siblings.push({ id: transaction.id, date: new Date(transaction.date), description: transaction.description });
  }

  return siblings.sort((a, b) => a.date.getTime() - b.date.getTime());
};

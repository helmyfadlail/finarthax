import { NextRequest } from "next/server";
import { DETECTION_DEFAULTS, detectRecurringPatterns, getTuning, getUserPreferences, listScheduledRecurrences, logger, prisma, readNumberPreference, requireAuth, withApi } from "@/lib";
import { successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { recurringFilterSchema } from "@/types";
import type { RecurringOverview } from "@/types";

export const GET = withApi("recurring.overview", async (req: NextRequest) => {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);

  // Query string wins, then the account's own preference, then the instance tuning.
  const [preferences, tuning] = await Promise.all([getUserPreferences(user.id), getTuning()]);

  const validation = recurringFilterSchema.safeParse({
    lookaheadDays: Number(searchParams.get("lookaheadDays") ?? readNumberPreference(preferences, "recurringLookaheadDays", DETECTION_DEFAULTS.lookaheadDays)),
    historyDays: Number(searchParams.get("historyDays") ?? tuning.recurringHistoryDays),
    minOccurrences: Number(searchParams.get("minOccurrences") ?? tuning.recurringMinOccurrences),
  });

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { lookaheadDays, historyDays, minOccurrences } = validation.data;
  const now = new Date();
  const historyStart = new Date(now.getTime() - historyDays * 24 * 60 * 60 * 1000);

  const scheduled = await listScheduledRecurrences(user.id, now);

  const due = scheduled.filter((item) => item.status !== "UPCOMING");
  const upcoming = scheduled.filter((item) => item.status === "UPCOMING" && item.daysUntil <= lookaheadDays);

  const history = await prisma.transaction.findMany({
    where: { userId: user.id, recurrenceKey: null, date: { gte: historyStart } },
    select: {
      id: true,
      type: true,
      accountId: true,
      toAccountId: true,
      categoryId: true,
      description: true,
      amount: true,
      date: true,
      recurrenceKey: true,
      recurrenceDismissedAt: true,
    },
    orderBy: { date: "asc" },
  });

  const doneDetection = logger.time("recurring.detect_patterns", { historyDays, sampleSize: history.length });

  const patterns = detectRecurringPatterns(
    history.map((transaction) => ({ ...transaction, amount: Number(transaction.amount) })),
    {
      minOccurrences,
      minConsistency: tuning.recurringMinConsistency,
      minConfidence: tuning.recurringMinConfidence,
      timeBucketMinutes: tuning.recurringTimeBucketMinutes,
      reference: now,
    },
  );

  doneDetection({ patterns: patterns.length });

  const detected = patterns.filter((pattern) => !pattern.dismissed);
  const dismissed = patterns.filter((pattern) => pattern.dismissed);

  const sumMonthly = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;

  const overview: RecurringOverview = {
    summary: {
      dueCount: due.length,
      upcomingCount: upcoming.length,
      detectedCount: detected.length,
      trackedCount: scheduled.length,
      monthlyCommitted: sumMonthly(scheduled.filter((item) => item.type === "EXPENSE").map((item) => item.monthlyEstimate)),
      monthlyPotential: sumMonthly(detected.filter((pattern) => pattern.type === "EXPENSE").map((pattern) => pattern.monthlyEstimate)),
    },
    due,
    upcoming,
    detected,
    dismissed,
  };

  logger.debug("recurring.overview_built", overview.summary as unknown as Record<string, unknown>);

  return successResponse(overview);
});

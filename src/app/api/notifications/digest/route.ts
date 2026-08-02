import { NextRequest } from "next/server";
import { isMailerConfigured, notifyRecurringDue, prisma, sendWeeklyReport } from "@/lib";
import { errorResponse, successResponse } from "@/utils";
import type { NotificationOutcome } from "@/lib";

export const dynamic = "force-dynamic";

type DigestKind = "weekly" | "recurring" | "all";

/**
 * Delivers the scheduled emails — the weekly summary and the recurring-due reminder — to every
 * account that asked for them. Each send still goes through the preference gate, so an account with
 * `emailNotifications` or the individual preference switched off is skipped here too.
 *
 * Meant for a scheduler (Kubernetes CronJob, Vercel Cron, GitHub Actions):
 *
 *   curl -X POST https://your-host/api/notifications/digest \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * A weekly cadence suits `weekly`; `recurring` is worth running daily.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return errorResponse("CRON_SECRET is not configured", 503);

    if (req.headers.get("authorization") !== `Bearer ${secret}`) return errorResponse("Unauthorized", 401);

    if (!isMailerConfigured()) return errorResponse("Email is not configured", 503);

    const kind = (new URL(req.url).searchParams.get("kind") ?? "all") as DigestKind;
    if (!["weekly", "recurring", "all"].includes(kind)) return errorResponse("kind must be weekly, recurring or all", 422);

    const users = await prisma.user.findMany({ select: { id: true } });

    const tally = { weekly: { sent: 0, skipped: 0 }, recurring: { sent: 0, skipped: 0 } };

    const record = (bucket: { sent: number; skipped: number }, outcome: NotificationOutcome) => {
      if (outcome.sent) bucket.sent += 1;
      else bucket.skipped += 1;
    };

    // Sequential on purpose: a burst of parallel sends is the fastest way to get rate limited.
    for (const user of users) {
      if (kind === "weekly" || kind === "all") record(tally.weekly, await sendWeeklyReport(user.id));
      if (kind === "recurring" || kind === "all") record(tally.recurring, await notifyRecurringDue(user.id));
    }

    return successResponse({ kind, processed: users.length, ...tally }, "Digest processed");
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
  }
}

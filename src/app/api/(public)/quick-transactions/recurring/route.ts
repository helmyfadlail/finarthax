import { NextRequest } from "next/server";
import { clientKey, confirmOccurrence, getTuning, getUserPreferences, logger, prisma, rateLimit, readBooleanPreference, trackSeries, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { quickRecurringActionSchema } from "@/types";

/**
 * The recurring half of the quick-entry page: confirm the occurrence that is due, or start tracking
 * a transaction as a series - without signing in.
 *
 * Logging an occurrence creates exactly the kind of row POST /quick-transactions already creates
 * from the same page, so this opens no door that page did not. What it does expose is *which*
 * transactions exist, which is why every action here is refused unless the account owner turned on
 * `publicQuickActivity`. Stopping or skipping a series is not offered at all: those silence a
 * reminder, and the account owner is the only one who should be able to do that.
 */
export const POST = withApi("quick_transactions.recurring", async (req: NextRequest) => {
  const tuning = await getTuning();
  const { allowed, retryAfter } = rateLimit(clientKey(req, "quick-recurring"), tuning.quickCreateRateLimit, tuning.quickRateLimitWindowSeconds * 1000);
  if (!allowed) {
    logger.warn("quick_transactions.rate_limited", { scope: "quick-recurring", retryAfter });
    return errorResponse(`Too many actions. Try again in ${retryAfter}s.`, 429);
  }

  const body = await req.json();
  const validation = quickRecurringActionSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { email, action, transactionId } = validation.data;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return errorResponse("User not found. Please create an account first", 404);

  const preferences = await getUserPreferences(user.id);
  if (!readBooleanPreference(preferences, "publicQuickActivity")) {
    // Same wording whether the id exists or not: this endpoint must not become a way to find out.
    logger.warn("quick_transactions.recurring_refused", { targetUserId: user.id, action });
    return errorResponse("This account does not allow recurring transactions to be managed from the quick-entry page.", 403);
  }

  const result =
    action === "log"
      ? await confirmOccurrence(user.id, transactionId, { amount: validation.data.amount, date: validation.data.date })
      : await trackSeries(user.id, transactionId, { isRecurring: true, interval: validation.data.interval, endDate: validation.data.endDate });

  if (result.error) return errorResponse(result.error, result.status ?? 400);

  // No session, so the owner has to be named explicitly - it is the only way to attribute a public
  // write to an account.
  logger.info("quick_transactions.recurring_done", { targetUserId: user.id, action, sourceId: transactionId, transactionId: result.transaction?.id });

  return successResponse(result.transaction, result.message);
});

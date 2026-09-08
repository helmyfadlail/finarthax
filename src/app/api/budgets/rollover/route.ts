import { NextRequest } from "next/server";
import { logger, rolloverBudgets, withApi } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export const dynamic = "force-dynamic";

/**
 * Creates this month's budget for every category with `autoRenew` set on last month's budget.
 * Meant for a scheduler firing once at the start of each month (Vercel Cron, GitHub Actions,
 * Kubernetes CronJob) - same `Bearer $CRON_SECRET` pattern as `/api/notifications/digest`:
 *
 *   curl -X POST https://your-host/api/budgets/rollover \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Safe to run more than once for the same month - existing budgets are left untouched.
 */
export const POST = withApi(
  "budgets.rollover",
  async (req: NextRequest) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error("budgets.rollover_not_configured", { reason: "missing_cron_secret" });
      return errorResponse("CRON_SECRET is not configured", 503);
    }

    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      logger.warn("budgets.rollover_unauthorized");
      return errorResponse("Unauthorized", 401);
    }

    const result = await rolloverBudgets();

    return successResponse(result, "Budget rollover processed");
  },
  { maintenance: false },
);

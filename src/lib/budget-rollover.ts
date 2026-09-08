import { logger, prisma } from "@/lib";

export interface BudgetRolloverResult {
  candidates: number;
  created: number;
}

/**
 * Copies each `autoRenew` budget from the prior month into the current one, skipping any
 * category/month/year that already has a budget row (so a rerun of the same month is a no-op,
 * not a duplicate). `spent` always starts at 0 - it is derived from the new month's transactions
 * the same way a manually-created budget is.
 */
export const rolloverBudgets = async (): Promise<BudgetRolloverResult> => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const priorMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const priorYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const candidates = await prisma.budget.findMany({
    where: { month: priorMonth, year: priorYear, autoRenew: true },
    select: { userId: true, categoryId: true, amount: true },
  });

  let created = 0;

  for (const candidate of candidates) {
    try {
      await prisma.budget.create({
        data: {
          userId: candidate.userId,
          categoryId: candidate.categoryId,
          amount: candidate.amount,
          month: currentMonth,
          year: currentYear,
          autoRenew: true,
        },
      });
      created += 1;
    } catch (error) {
      // Unique constraint hit (a budget already exists for this month/category) - expected on a
      // rerun, not a failure worth logging above debug.
      logger.debug("budgets.rollover_skipped", { userId: candidate.userId, categoryId: candidate.categoryId, err: error });
    }
  }

  logger.info("budgets.rolled_over", { month: currentMonth, year: currentYear, candidates: candidates.length, created });

  return { candidates: candidates.length, created };
};

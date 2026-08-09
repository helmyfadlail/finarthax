import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateBudgetSchema } from "@/types";

export const PUT = withApi<{ id: string }>("budgets.update", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = updateBudgetSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const existing = await prisma.budget.findFirst({ where: { id, userId: user.id } });

  if (!existing) return errorResponse("Budget not found", 404);

  const budget = await prisma.budget.update({
    where: { id },
    data: { amount: validation.data.amount },
    include: { category: true },
  });

  logger.info("budgets.updated", { budgetId: id, amount: validation.data.amount });

  return successResponse(budget, "Budget updated successfully");
});

export const DELETE = withApi<{ id: string }>("budgets.delete", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const budget = await prisma.budget.findFirst({ where: { id, userId: user.id } });

  if (!budget) return errorResponse("Budget not found", 404);

  await prisma.budget.delete({ where: { id } });

  logger.info("budgets.deleted", { budgetId: id });

  return successResponse(null, "Budget deleted successfully");
});

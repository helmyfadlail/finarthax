import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateGoalProgressSchema } from "@/types";

export const PATCH = withApi<{ id: string }>("goals.progress", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = updateGoalProgressSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const existing = await prisma.goal.findFirst({ where: { id, userId: user.id } });

  if (!existing) return errorResponse("Goal not found", 404);

  const newStatus = validation.data.currentAmount >= existing.targetAmount.toNumber() ? "COMPLETED" : existing.status;

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      currentAmount: validation.data.currentAmount,
      status: newStatus,
    },
  });

  logger.info("goals.progress_updated", {
    goalId: id,
    previousAmount: existing.currentAmount.toNumber(),
    currentAmount: validation.data.currentAmount,
    targetAmount: existing.targetAmount.toNumber(),
    ...(newStatus !== existing.status && { statusChangedTo: newStatus }),
  });

  return successResponse(goal, "Progress goal updated successfully");
});

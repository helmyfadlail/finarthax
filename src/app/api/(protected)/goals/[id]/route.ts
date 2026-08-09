import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateGoalSchema } from "@/types";

export const PUT = withApi<{ id: string }>("goals.update", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = updateGoalSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const existing = await prisma.goal.findFirst({ where: { id, userId: user.id } });

  if (!existing) return errorResponse("Goal not found", 404);

  const data = validation.data;

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      ...data,
      ...(data.deadline && { deadline: new Date(data.deadline) }),
    },
  });

  logger.info("goals.updated", { goalId: id, fields: Object.keys(data), status: goal.status });

  return successResponse(goal, "Goal updated successfully");
});

export const DELETE = withApi<{ id: string }>("goals.delete", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const goal = await prisma.goal.findFirst({ where: { id, userId: user.id } });

  if (!goal) return errorResponse("Goal not found", 404);

  await prisma.goal.delete({ where: { id } });

  logger.info("goals.deleted", { goalId: id });

  return successResponse(null, "Goal deleted successfully");
});

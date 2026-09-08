import { NextRequest } from "next/server";
import { logger, prisma, recordAuditLog, requireAuth, withApi } from "@/lib";
import { GoalStatus } from "prisma-client/enums";
import { BASE_CURRENCY } from "@/static";
import { successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { goalSchema } from "@/types";

export const GET = withApi("goals.list", async (req: NextRequest) => {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status");

  const goals = await prisma.goal.findMany({
    where: { userId: user.id, ...(status && { status: status as GoalStatus }) },
    orderBy: { createdAt: "desc" },
  });

  return successResponse(goals);
});

export const POST = withApi("goals.create", async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await req.json();
  const validation = goalSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const data = validation.data;

  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      name: data.name,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount,
      currency: data.currency ?? BASE_CURRENCY,
      deadline: data.deadline ? new Date(data.deadline) : null,
      status: data.status,
    },
  });

  logger.info("goals.created", { goalId: goal.id, targetAmount: Number(goal.targetAmount), hasDeadline: goal.deadline !== null });

  await recordAuditLog({
    entityType: "goal",
    entityId: goal.id,
    action: "create",
    newValue: { name: goal.name, targetAmount: goal.targetAmount.toNumber(), currentAmount: goal.currentAmount.toNumber() },
    actor: user,
  });

  return successResponse(goal, "Goal created successfully");
});

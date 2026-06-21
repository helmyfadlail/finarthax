import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { GoalStatus } from "prisma-client/enums";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { goalSchema } from "@/types";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { searchParams } = new URL(req.url);

      const status = searchParams.get("status");

      const goals = await prisma.goal.findMany({
        where: { userId: user.id, ...(status && { status: status as GoalStatus }) },
        orderBy: { createdAt: "desc" },
      });

      return successResponse(goals);
    } catch (error) {
      console.error(error);

      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);

      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
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
          deadline: data.deadline ? new Date(data.deadline) : null,
          status: data.status,
        },
      });

      return successResponse(goal, "Goal created successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

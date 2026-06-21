import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateGoalProgressSchema } from "@/types";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
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

      return successResponse(goal, "Progress goal updated successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

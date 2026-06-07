import { NextRequest } from "next/server";

import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse, validationErrorResponse } from "@/utils";

import z from "zod";

import { updateGoalSchema } from "@/types";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
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

      return successResponse(goal, "Goal updated successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { id } = await params;

      const goal = await prisma.goal.findFirst({ where: { id, userId: user.id } });

      if (!goal) return errorResponse("Goal not found", 404);

      await prisma.goal.delete({ where: { id } });

      return successResponse(null, "Goal deleted successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

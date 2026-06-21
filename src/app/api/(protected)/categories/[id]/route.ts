import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateCategorySchema } from "@/types";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { id } = await params;

      const body = await req.json();
      const validation = updateCategorySchema.safeParse(body);

      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const existing = await prisma.category.findFirst({ where: { id, userId: user.id } });

      if (!existing) return errorResponse("Category not found", 404);

      if (existing.isDefault) return errorResponse("The default category cannot be changed", 403);

      const category = await prisma.category.update({ where: { id }, data: validation.data });

      return successResponse(category, "Category updated successfully");
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

      const category = await prisma.category.findFirst({ where: { id, userId: user.id } });

      if (!category) return errorResponse("Category not found", 404);

      if (category.isDefault) return errorResponse("The default category cannot be changed", 403);

      await prisma.category.delete({ where: { id } });

      return successResponse(null, "Category deleted successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

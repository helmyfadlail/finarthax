import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateCategorySchema } from "@/types";

export const PUT = withApi<{ id: string }>("categories.update", async (req: NextRequest, { params }) => {
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

  logger.info("categories.updated", { categoryId: id, fields: Object.keys(validation.data) });

  return successResponse(category, "Category updated successfully");
});

export const DELETE = withApi<{ id: string }>("categories.delete", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const category = await prisma.category.findFirst({ where: { id, userId: user.id } });

  if (!category) return errorResponse("Category not found", 404);

  if (category.isDefault) return errorResponse("The default category cannot be changed", 403);

  await prisma.category.delete({ where: { id } });

  logger.info("categories.deleted", { categoryId: id });

  return successResponse(null, "Category deleted successfully");
});

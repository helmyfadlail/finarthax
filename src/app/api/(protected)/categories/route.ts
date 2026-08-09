import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { categorySchema } from "@/types";

export const GET = withApi("categories.list", async (req: NextRequest) => {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const categories = await prisma.category.findMany({
    where: {
      OR: [{ userId: user.id }],
      ...(type && { type: type as "INCOME" | "EXPENSE" }),
    },
    orderBy: { name: "asc" },
  });

  return successResponse(categories);
});

export const POST = withApi("categories.create", async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await req.json();
  const validation = categorySchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const maxCategoriesSetting = await prisma.appSetting.findFirst({ where: { key: "max_categories_per_user" } });

  const maxCategories = parseInt(maxCategoriesSetting?.value || "0");

  const userCategoryCount = await prisma.category.count({ where: { userId: user.id } });

  if (userCategoryCount >= maxCategories) {
    logger.warn("categories.limit_reached", { current: userCategoryCount, max: maxCategories });
    return errorResponse("Maximum number of categories reached", 400);
  }

  const category = await prisma.category.create({ data: { userId: user.id, ...validation.data } });

  logger.info("categories.created", { categoryId: category.id, type: category.type });

  return successResponse(category, "Category created successfully");
});

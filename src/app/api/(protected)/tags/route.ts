import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { tagSchema } from "@/types";

export const GET = withApi("tags.list", async () => {
  const user = await requireAuth();

  const tags = await prisma.tag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });

  return successResponse(tags);
});

export const POST = withApi("tags.create", async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await req.json();
  const validation = tagSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const tag = await prisma.tag.create({ data: { userId: user.id, ...validation.data } });

  logger.info("tags.created", { tagId: tag.id });

  return successResponse(tag, "Tag created successfully");
});

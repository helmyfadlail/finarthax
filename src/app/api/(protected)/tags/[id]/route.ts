import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateTagSchema } from "@/types";

export const PUT = withApi<{ id: string }>("tags.update", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = updateTagSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const existing = await prisma.tag.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Tag not found", 404);

  const tag = await prisma.tag.update({ where: { id }, data: validation.data });

  logger.info("tags.updated", { tagId: id, fields: Object.keys(validation.data) });

  return successResponse(tag, "Tag updated successfully");
});

export const DELETE = withApi<{ id: string }>("tags.delete", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const tag = await prisma.tag.findFirst({ where: { id, userId: user.id } });
  if (!tag) return errorResponse("Tag not found", 404);

  await prisma.tag.delete({ where: { id } });

  logger.info("tags.deleted", { tagId: id });

  return successResponse(null, "Tag deleted successfully");
});

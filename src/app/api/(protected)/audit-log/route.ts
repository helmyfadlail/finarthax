import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { Prisma } from "prisma-client/client";
import { successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { auditLogFilterSchema } from "@/types";

export const GET = withApi("audit-log.list", async (req: NextRequest) => {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);

  const filterData = {
    entityType: searchParams.get("entityType") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
  };

  const validation = auditLogFilterSchema.safeParse(filterData);
  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { entityType, startDate, endDate, page, limit } = validation.data;

  // Financial audit rows are only ever traced back to their actor, since the entities they
  // describe (accounts/transactions/budgets/goals) can already be deleted by the time this is read.
  const where: Prisma.AuditLogWhereInput = {
    actorId: user.id,
    ...(entityType && { entityType }),
    ...(startDate || endDate ? { createdAt: { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.auditLog.count({ where }),
  ]);

  logger.debug("audit-log.listed", { returned: data.length, total, page, limit });

  return successResponse({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

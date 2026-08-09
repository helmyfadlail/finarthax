import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateAccountSchema } from "@/types";

export const PUT = withApi<{ id: string }>("accounts.update", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = updateAccountSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const existing = await prisma.account.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Account not found", 404);

  const data = validation.data;

  if (data.isDefault) {
    await prisma.account.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
  }

  const effectiveType = data.type ?? existing.type;

  const updateData = effectiveType !== "CREDIT_CARD" ? { ...data, creditLimit: null } : data;

  const account = await prisma.account.update({ where: { id }, data: updateData });

  logger.info("accounts.updated", { accountId: id, fields: Object.keys(data) });

  return successResponse(account, "Account updated successfully");
});

export const DELETE = withApi<{ id: string }>("accounts.delete", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const account = await prisma.account.findFirst({ where: { id, userId: user.id } });
  if (!account) return errorResponse("Account not found", 404);

  const transactionCount = await prisma.transaction.count({ where: { OR: [{ accountId: id }, { toAccountId: id }] } });

  if (transactionCount > 0) {
    logger.warn("accounts.delete_blocked", { accountId: id, transactionCount });
    return errorResponse("Cannot delete an account that has transactions", 400);
  }

  await prisma.account.delete({ where: { id } });

  logger.info("accounts.deleted", { accountId: id });

  return successResponse(null, "Account deleted successfully");
});

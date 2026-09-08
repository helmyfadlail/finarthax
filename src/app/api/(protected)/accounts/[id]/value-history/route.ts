import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { accountValueUpdateSchema } from "@/types";

export const GET = withApi<{ id: string }>("accounts.value-history.list", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const account = await prisma.account.findFirst({ where: { id, userId: user.id } });
  if (!account) return errorResponse("Account not found", 404);

  const history = await prisma.accountValueHistory.findMany({
    where: { accountId: id },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });

  return successResponse(history);
});

export const POST = withApi<{ id: string }>("accounts.value-history.create", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const validation = accountValueUpdateSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const account = await prisma.account.findFirst({ where: { id, userId: user.id } });
  if (!account) return errorResponse("Account not found", 404);

  if (account.type !== "INVESTMENT") {
    return errorResponse("Value check-ins are only available for investment accounts", 400);
  }

  const { newBalance, note, recordedAt } = validation.data;

  const previousBalance = account.balance.toNumber();
  const changeAmount = newBalance - previousBalance;
  const changePercent = previousBalance !== 0 ? (changeAmount / Math.abs(previousBalance)) * 100 : newBalance === 0 ? 0 : 100;

  const [, history] = await prisma.$transaction([
    prisma.account.update({ where: { id }, data: { balance: newBalance } }),
    prisma.accountValueHistory.create({
      data: {
        accountId: id,
        previousBalance,
        newBalance,
        changeAmount,
        changePercent,
        note: note || null,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      },
    }),
  ]);

  logger.info("accounts.value_history.created", { accountId: id, changeAmount, changePercent });

  return successResponse(history, "Investment value updated successfully");
});

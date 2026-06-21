import { NextRequest } from "next/server";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { accountSchema } from "@/types";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();

      const accounts = await prisma.account.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });

      return successResponse(accounts);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const body = await req.json();
      const validation = accountSchema.safeParse(body);

      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const maxAccountsSetting = await prisma.appSetting.findFirst({ where: { key: "max_accounts_per_user" } });

      const maxAccounts = parseInt(maxAccountsSetting?.value || "0");

      const userAccountCount = await prisma.account.count({ where: { userId: user.id } });

      if (userAccountCount >= maxAccounts) return errorResponse("Maximum number of accounts reached", 400);

      const data = validation.data;

      if (data.isDefault) {
        await prisma.account.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
      }

      const accountData = data.type !== "CREDIT_CARD" ? { ...data, creditLimit: undefined } : data;

      const account = await prisma.account.create({ data: { userId: user.id, ...accountData } });

      return successResponse(account, "Account created successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

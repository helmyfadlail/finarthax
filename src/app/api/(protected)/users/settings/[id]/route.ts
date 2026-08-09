import { NextRequest } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateSettingValueSchema } from "@/types";

export const PATCH = withApi<{ id: string }>("users.settings.update", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();

  const validation = updateSettingValueSchema.safeParse(body);
  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const existingSetting = await prisma.userSetting.findUnique({ where: { userId_key: { userId: user.id, key: id } } });

  if (!existingSetting) return errorResponse("Setting not found. Please create a new setting first.", 404);

  const setting = await prisma.userSetting.update({
    where: { userId_key: { userId: user.id, key: id } },
    data: { value: validation.data.value },
  });

  // Settings change behaviour (currency, notifications, lookahead) - the before/after
  // pair explains "it started acting differently" reports.
  logger.info("users.setting_changed", { key: id, from: existingSetting.value, to: validation.data.value });

  return successResponse(setting, "Setting value updated successfully");
});

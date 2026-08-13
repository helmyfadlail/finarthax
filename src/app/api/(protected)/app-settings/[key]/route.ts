import { NextRequest } from "next/server";
import { clearTuningCache, isCatalogueKey, logger, prisma, recordAppSettingAudit, requireSuperAdmin, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { updateAppSettingSchema } from "@/types";

/** A value is stored as text whatever its declared type, so it is checked against that type here. */
const valueError = (type: string, value: string): string | null => {
  if (type === "number" && !Number.isFinite(Number(value))) return "Value must be a number";
  if (type === "boolean" && !["true", "false"].includes(value)) return 'Value must be "true" or "false"';

  if (type === "json") {
    try {
      JSON.parse(value);
    } catch {
      return "Value must be valid JSON";
    }
  }

  return null;
};

export const GET = withApi<{ key: string }>("app_settings.detail", async (_req: NextRequest, { params }) => {
  await requireSuperAdmin();
  const { key } = await params;

  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting) return errorResponse("Setting not found", 404);

  // The last few changes travel with the row: on this screen the previous value is the fastest
  // way back out of a bad edit.
  const history = await prisma.appSettingAudit.findMany({ where: { key }, orderBy: { createdAt: "desc" }, take: 10 });

  return successResponse({ ...setting, isCatalogue: isCatalogueKey(setting.key), history });
});

export const PATCH = withApi<{ key: string }>("app_settings.update", async (req: NextRequest, { params }) => {
  const actor = await requireSuperAdmin();
  const { key } = await params;

  const body = await req.json();
  const validation = updateAppSettingSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const data = validation.data;

  const existing = await prisma.appSetting.findUnique({ where: { key } });
  if (!existing) return errorResponse("Setting not found", 404);

  // A value sent without a type is checked against the stored one, and a type sent without a value
  // is checked against the stored value - either half alone can still make the row inconsistent.
  const effectiveType = data.type ?? existing.type;
  const effectiveValue = data.value ?? existing.value;
  const error = valueError(effectiveType, effectiveValue);
  if (error) return validationErrorResponse({ value: [error] });

  const setting = await prisma.appSetting.update({ where: { key }, data });

  if (existing.value !== setting.value) {
    await recordAppSettingAudit({ key, action: "update", previousValue: existing.value, newValue: setting.value, actor });
  }

  clearTuningCache();

  logger.info("app_settings.updated", {
    key,
    ...(existing.value !== setting.value && { from: existing.value, to: setting.value }),
    fields: Object.keys(data),
    actorId: actor.id,
  });

  return successResponse({ ...setting, isCatalogue: isCatalogueKey(setting.key) }, "Setting updated successfully");
});

export const DELETE = withApi<{ key: string }>("app_settings.delete", async (_req: NextRequest, { params }) => {
  const actor = await requireSuperAdmin();
  const { key } = await params;

  const existing = await prisma.appSetting.findUnique({ where: { key } });
  if (!existing) return errorResponse("Setting not found", 404);

  // Catalogue rows are read by name inside features and rewritten by the seed on every deploy, so
  // deleting one buys nothing and breaks something until the next seed. Retune it instead.
  if (isCatalogueKey(key)) {
    return errorResponse(`"${key}" is a built-in setting and cannot be deleted. Change its value instead.`, 409);
  }

  await prisma.appSetting.delete({ where: { key } });

  await recordAppSettingAudit({ key, action: "delete", previousValue: existing.value, actor });

  clearTuningCache();

  logger.warn("app_settings.deleted", { key, value: existing.value, actorId: actor.id });

  return successResponse({ key }, "Setting deleted successfully");
});

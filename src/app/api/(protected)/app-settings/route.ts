import { NextRequest } from "next/server";
import { clearTuningCache, isCatalogueKey, logger, prisma, recordAppSettingAudit, requireSuperAdmin, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { createAppSettingSchema } from "@/types";

/**
 * The whole `app_settings` table, including the rows the public endpoint hides.
 *
 * `/api/settings` serves only `isPublic` rows to anyone; this one is the superadmin view of the
 * same table - feature flags, limits and tuning included.
 */
export const GET = withApi("app_settings.list", async (req: NextRequest) => {
  await requireSuperAdmin();

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const search = searchParams.get("search")?.trim() || undefined;

  const settings = await prisma.appSetting.findMany({
    where: {
      ...(category && { category }),
      ...(search && {
        OR: [
          { key: { contains: search, mode: "insensitive" as const } },
          { label: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
  });

  const categories = await prisma.appSetting.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });

  logger.debug("app_settings.listed", { returned: settings.length, category, search });

  return successResponse({
    // `isCatalogue` tells the screen which rows the seed owns, so it can explain why they cannot
    // be deleted instead of failing the request with no reason.
    data: settings.map((setting) => ({ ...setting, isCatalogue: isCatalogueKey(setting.key) })),
    categories: categories.map((row) => row.category),
  });
});

export const POST = withApi("app_settings.create", async (req: NextRequest) => {
  const actor = await requireSuperAdmin();

  const body = await req.json();
  const validation = createAppSettingSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const data = validation.data;

  const existing = await prisma.appSetting.findUnique({ where: { key: data.key } });
  if (existing) return errorResponse(`A setting with the key "${data.key}" already exists`, 409);

  const setting = await prisma.appSetting.create({ data });

  await recordAppSettingAudit({ key: setting.key, action: "create", newValue: setting.value, actor });

  // The tuning cache holds values by key for a minute; a new row has to be visible now, not
  // whenever that window happens to close.
  clearTuningCache();

  logger.info("app_settings.created", { key: setting.key, type: setting.type, category: setting.category, isPublic: setting.isPublic, actorId: actor.id });

  return successResponse({ ...setting, isCatalogue: isCatalogueKey(setting.key) }, "Setting created successfully");
});

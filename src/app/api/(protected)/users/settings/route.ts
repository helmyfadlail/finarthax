import { logger, prisma, requireAuth, withApi } from "@/lib";
import { successResponse } from "@/utils";
import { USER_SETTINGS } from "@/static";

export const GET = withApi("users.settings.list", async () => {
  const user = await requireAuth();

  const existing = await prisma.userSetting.findMany({ where: { userId: user.id }, select: { key: true } });
  const existingKeys = new Set(existing.map((setting) => setting.key));
  const catalogueKeys = new Set(USER_SETTINGS.map((setting) => setting.key));

  const missing = USER_SETTINGS.filter((setting) => !existingKeys.has(setting.key));
  const retired = [...existingKeys].filter((key) => !catalogueKeys.has(key));

  if (missing.length > 0 || retired.length > 0) {
    // This GET silently writes when the settings catalogue changes - a deploy that
    // renames a key shows up here as a burst of adds and removes.
    logger.info("users.settings_reconciled", { added: missing.map((setting) => setting.key), removed: retired });

    await prisma.$transaction(async (tx) => {
      if (missing.length > 0) {
        await tx.userSetting.createMany({ data: missing.map((setting) => ({ userId: user.id, ...setting })), skipDuplicates: true });
      }

      if (retired.length > 0) {
        await tx.userSetting.deleteMany({ where: { userId: user.id, key: { in: retired } } });
      }
    });
  }

  const settings = await prisma.userSetting.findMany({ where: { userId: user.id }, orderBy: [{ category: "asc" }, { key: "asc" }] });

  return successResponse(settings);
});

import { logger, prisma, withApi } from "@/lib";
import { successResponse } from "@/utils";

export const GET = withApi("settings.public", async () => {
  const settings = await prisma.appSetting.findMany({
    where: { isPublic: true },
    orderBy: [{ category: "asc" }, { key: "asc" }, { sortOrder: "asc" }],
    select: {
      key: true,
      value: true,
      type: true,
      category: true,
      label: true,
      description: true,
    },
  });

  const parsed = settings.map((s) => {
    if (s.type !== "json") return s;

    try {
      return { ...s, value: JSON.parse(s.value) };
    } catch (error) {
      logger.error("settings.invalid_json", { key: s.key, err: error });
      return s;
    }
  });

  return successResponse(parsed);
});

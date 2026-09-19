import { prisma } from "./prisma";
import { logger } from "./logger";

export const isMaintenanceModeEnabled = async (): Promise<boolean> => {
  try {
    const setting = await prisma.appSetting.findFirst({ where: { key: "maintenance_mode" } });
    return setting?.value === "true";
  } catch (error) {
    logger.error("maintenance.check_failed", { err: error });
    return false;
  }
};

import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Reads the `maintenance_mode` app setting. `withApi` calls this on every unsafe
 * request, so a lookup failure must not take the whole API down with it: if the
 * setting cannot be read the request is allowed through and the problem is logged.
 */
export const isMaintenanceModeEnabled = async (): Promise<boolean> => {
  try {
    const setting = await prisma.appSetting.findFirst({ where: { key: "maintenance_mode" } });
    return setting?.value === "true";
  } catch (error) {
    logger.error("maintenance.check_failed", { err: error });
    return false;
  }
};

import { prisma } from "@/lib";

const DEFAULT_MAX_PASSWORD_AGE_DAYS = 90;

export async function getMaxPasswordAgeDays(): Promise<number> {
  const setting = await prisma.appSetting.findFirst({ where: { key: "max_password_age_days" } });

  const parsed = parseInt(setting?.value as string, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_PASSWORD_AGE_DAYS;
}

export function calculatePasswordExpiresAt(from: Date, maxAgeDays: number): Date {
  return new Date(from.getTime() + maxAgeDays * 24 * 60 * 60 * 1000);
}

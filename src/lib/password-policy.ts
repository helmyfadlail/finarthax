import { prisma } from "@/lib";

export async function getMaxPasswordAgeDays(): Promise<number> {
  const setting = await prisma.appSetting.findFirst({ where: { key: "max_password_age_days" } });

  const parsed = parseInt(setting?.value as string, 10);

  return parsed;
}

export function calculatePasswordExpiresAt(from: Date, maxAgeDays: number): Date {
  return new Date(from.getTime() + maxAgeDays * 24 * 60 * 60 * 1000);
}

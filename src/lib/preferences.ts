import { prisma } from "@/lib";
import { USER_SETTINGS } from "@/static";

export const getUserPreferences = async (userId: string): Promise<Record<string, string>> => {
  const rows = await prisma.userSetting.findMany({ where: { userId }, select: { key: true, value: true } });

  const preferences: Record<string, string> = {};
  for (const setting of USER_SETTINGS) preferences[setting.key] = setting.value;
  for (const row of rows) preferences[row.key] = row.value;

  return preferences;
};

export const readBooleanPreference = (preferences: Record<string, string>, key: string): boolean => preferences[key] === "true";

export const readNumberPreference = (preferences: Record<string, string>, key: string, fallback: number): number => {
  const parsed = Number(preferences[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const canSendEmail = async (userId: string, kind: "weeklyReports"): Promise<boolean> => {
  const preferences = await getUserPreferences(userId);
  return readBooleanPreference(preferences, "emailNotifications") && readBooleanPreference(preferences, kind);
};

import { z } from "zod";

export const SettingType = z.enum(["boolean", "string", "number", "object", "array"]);
export const SettingCategory = z.enum(["general", "notifications", "appearance", "security", "privacy", "billing"]);

export const updateSettingValueSchema = z.object({ value: z.string() });

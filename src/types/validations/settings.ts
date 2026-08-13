import { z } from "zod";

export const SettingType = z.enum(["boolean", "string", "number", "object", "array"]);
export const SettingCategory = z.enum(["general", "notifications", "appearance", "security", "privacy", "billing"]);

export const updateSettingValueSchema = z.object({ value: z.string() });

/** The shapes an `app_settings` row may declare. `json` covers both objects and arrays. */
export const appSettingTypeSchema = z.enum(["string", "number", "boolean", "json"]);

/**
 * A key is what the code looks a setting up by, so it is held to the same shape as the catalogue in
 * src/static/app-settings.ts: lower snake_case, and never renamed by accident.
 */
const appSettingKeySchema = z
  .string()
  .min(2, "Key is too short")
  .max(64, "Key is too long")
  .regex(/^[a-z][a-z0-9_]*$/, "Key must be lower snake_case, e.g. recurring_history_days");

const appSettingCategorySchema = z
  .string()
  .min(2, "Category is too short")
  .max(32, "Category is too long")
  .regex(/^[a-z][a-z0-9_]*$/, "Category must be lower snake_case");

/**
 * The value is stored as text whatever the declared type, so it is validated against that type
 * here - a `number` row holding "abc" would otherwise only fail much later, inside a feature.
 */
const valueMatchesType = (data: { type: z.infer<typeof appSettingTypeSchema>; value: string }, ctx: z.RefinementCtx): void => {
  if (data.type === "number" && !Number.isFinite(Number(data.value))) {
    ctx.addIssue({ code: "custom", message: "Value must be a number", path: ["value"] });
  }

  if (data.type === "boolean" && !["true", "false"].includes(data.value)) {
    ctx.addIssue({ code: "custom", message: 'Value must be "true" or "false"', path: ["value"] });
  }

  if (data.type === "json") {
    try {
      JSON.parse(data.value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Value must be valid JSON", path: ["value"] });
    }
  }
};

export const createAppSettingSchema = z
  .object({
    key: appSettingKeySchema,
    value: z.string().max(20_000, "Value is too long"),
    type: appSettingTypeSchema.default("string"),
    category: appSettingCategorySchema.default("general"),
    label: z.string().min(1, "Label is required").max(120, "Label is too long"),
    description: z.string().max(500, "Description is too long").optional().nullable(),
    sortOrder: z.number().int().min(0).max(9_999).default(0),
    isPublic: z.boolean().default(true),
  })
  .superRefine(valueMatchesType);

/**
 * The key is deliberately absent: it is the identifier the code reads by, so renaming one is a
 * delete plus a create, not an edit that silently detaches a feature from its setting.
 */
export const updateAppSettingSchema = z
  .object({
    value: z.string().max(20_000, "Value is too long"),
    type: appSettingTypeSchema,
    category: appSettingCategorySchema,
    label: z.string().min(1, "Label is required").max(120, "Label is too long"),
    description: z.string().max(500, "Description is too long").optional().nullable(),
    sortOrder: z.number().int().min(0).max(9_999),
    isPublic: z.boolean(),
  })
  .partial()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) ctx.addIssue({ code: "custom", message: "Nothing to update" });
    // Type-checking a value needs both halves; a value sent without a type is checked against the
    // stored one in the route, where that is known.
    if (data.value !== undefined && data.type !== undefined) valueMatchesType({ type: data.type, value: data.value }, ctx);
  });

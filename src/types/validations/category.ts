import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(50),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Color must be in hex format")
    .optional()
    .nullable(),
  isDefault: z.boolean().default(false),
});

export const updateCategorySchema = categorySchema.partial().extend({
  isDefault: z.boolean().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

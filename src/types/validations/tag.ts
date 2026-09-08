import { z } from "zod";

export const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(30),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Color must be in hex format")
    .optional()
    .nullable(),
});

export const updateTagSchema = tagSchema.partial();

import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(50),
  type: z.enum(["CASH", "BANK", "EWALLET", "CREDIT_CARD", "INVESTMENT"]),
  balance: z.number().default(0),
  currency: z.string().min(1).max(10).optional(),
  creditLimit: z.number().default(0).nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional()
    .nullable(),
  icon: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
});

/**
 * `.partial()` alone would still apply `accountSchema`'s `.default(...)` fields whenever they are
 * omitted from an update - silently resetting balance/creditLimit/isDefault to 0/0/false instead
 * of leaving them untouched. These three are re-declared as plain optionals with no default.
 */
export const updateAccountSchema = accountSchema.partial().extend({
  balance: z.number().optional(),
  creditLimit: z.number().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const accountValueUpdateSchema = z.object({
  newBalance: z.number(),
  note: z.string().max(200).optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

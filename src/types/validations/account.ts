import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(50),
  type: z.enum(["CASH", "BANK", "EWALLET", "CREDIT_CARD", "INVESTMENT"]),
  balance: z.number().default(0),
  creditLimit: z.number().default(0).nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional()
    .nullable(),
  icon: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
});

export const updateAccountSchema = accountSchema.partial();

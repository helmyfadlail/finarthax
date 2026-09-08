import { z } from "zod";

export const goalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(100),
  targetAmount: z.number().positive("Target amount must be greater than 0"),
  currentAmount: z.number().min(0, "Current amount cannot be negative").default(0),
  currency: z.string().min(1).max(10).optional(),
  deadline: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
});

/** See the comment on updateAccountSchema: `.partial()` alone would reset currentAmount/status to their defaults whenever omitted. */
export const updateGoalSchema = goalSchema.partial().extend({
  currentAmount: z.number().min(0, "Current amount cannot be negative").optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export const updateGoalProgressSchema = z.object({
  currentAmount: z.number().min(0, "Current amount cannot be negative"),
});

import { z } from "zod";

export const recurrenceIntervalSchema = z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]);

export const recurrenceFields = {
  isRecurring: z.boolean().optional(),
  recurrenceInterval: recurrenceIntervalSchema.optional().nullable(),
  recurrenceEndDate: z.string().optional().nullable(),
};

export const trackRecurringSchema = z
  .object({
    isRecurring: z.boolean(),
    interval: recurrenceIntervalSchema.optional().nullable(),
    endDate: z.string().optional().nullable(),
  })
  .refine((data) => !data.isRecurring || !!data.interval, {
    message: "Interval is required when tracking a transaction as recurring",
    path: ["interval"],
  });

export const confirmRecurringSchema = z.object({
  amount: z.number().positive("Amount must be positive").optional(),
  date: z.string().optional(),
  description: z.string().max(200, "Description is too long").optional(),
  interval: recurrenceIntervalSchema.optional(),
  keepTracking: z.boolean().optional(),
});

/**
 * What the public quick-entry page may do to a series: log the occurrence that is due, and start
 * tracking one. Stopping, skipping and dismissing are deliberately absent - they silence a
 * reminder, and nothing on an unauthenticated page should be able to do that.
 */
export const quickRecurringActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("log"),
    email: z.string().email("Invalid email address"),
    transactionId: z.string().min(1, "Transaction is required"),
    amount: z.number().positive("Amount must be positive").optional(),
    date: z.string().optional(),
  }),
  z.object({
    action: z.literal("track"),
    email: z.string().email("Invalid email address"),
    transactionId: z.string().min(1, "Transaction is required"),
    interval: recurrenceIntervalSchema,
    endDate: z.string().optional().nullable(),
  }),
]);

export const recurringFilterSchema = z.object({
  lookaheadDays: z.number().int().min(1).max(90).default(14),
  historyDays: z.number().int().min(30).max(1095).default(365),
  minOccurrences: z.number().int().min(2).max(12).default(3),
});

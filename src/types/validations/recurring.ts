import { z } from "zod";

export const recurrenceIntervalSchema = z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]);

/**
 * A date/time the caller picked - "Log now" lets the quick-entry page override the occurrence date,
 * so the raw string has to be a real, parseable timestamp before `new Date(...)` writes it to the DB.
 */
export const occurrenceDateSchema = z
  .string()
  .trim()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date");

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
  date: occurrenceDateSchema.optional(),
  description: z.string().max(200, "Description is too long").optional(),
  interval: recurrenceIntervalSchema.optional(),
  keepTracking: z.boolean().optional(),
});

export const quickRecurringActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("log"),
    email: z.string("Invalid email address"),
    transactionId: z.string().min(1, "Transaction is required"),
    amount: z.number().positive("Amount must be positive").optional(),
    date: occurrenceDateSchema.optional(),
  }),
  z.object({
    action: z.literal("track"),
    email: z.string("Invalid email address"),
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

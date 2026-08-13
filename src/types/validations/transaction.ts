import { z } from "zod";
import { recurrenceFields } from "./recurring";

const incomeExpenseSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  attachment: z.string().optional(),
});

const transferBaseSchema = z.object({
  type: z.literal("TRANSFER"),
  accountId: z.string().min(1, "Source account is required"),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  attachment: z.string().optional(),
});

export const transactionSchema = z.discriminatedUnion("type", [
  incomeExpenseSchema.extend({ ...recurrenceFields, type: z.literal("INCOME") }),

  incomeExpenseSchema.extend({ ...recurrenceFields, type: z.literal("EXPENSE") }),

  transferBaseSchema.extend(recurrenceFields).refine((d) => !d.toAccountId || d.toAccountId !== d.accountId, {
    message: "Source and destination accounts must be different",
    path: ["toAccountId"],
  }),
]);

export const updateTransactionSchema = z.discriminatedUnion("type", [
  incomeExpenseSchema
    .extend({ type: z.literal("INCOME") })
    .partial()
    .required({ type: true }),

  incomeExpenseSchema
    .extend({ type: z.literal("EXPENSE") })
    .partial()
    .required({ type: true }),

  transferBaseSchema
    .partial()
    .required({ type: true })
    .refine((d) => !d.toAccountId || d.toAccountId !== d.accountId, {
      message: "Source and destination accounts must be different",
      path: ["toAccountId"],
    }),
]);

/**
 * The quick-entry form is the same transaction the dashboard writes, so it carries the same
 * recurrence fields - a subscription entered from the public page is tracked like any other.
 */
export const quickTransactionSchema = z.discriminatedUnion("type", [
  incomeExpenseSchema.extend({
    ...recurrenceFields,
    email: z.string().email("Invalid email address"),
    type: z.literal("INCOME"),
  }),

  incomeExpenseSchema.extend({
    ...recurrenceFields,
    email: z.string().email("Invalid email address"),
    type: z.literal("EXPENSE"),
  }),

  transferBaseSchema
    .extend({
      ...recurrenceFields,
      email: z.string().email("Invalid email address"),
    })
    .refine((d) => !d.toAccountId || d.toAccountId !== d.accountId, {
      message: "Source and destination accounts must be different",
      path: ["toAccountId"],
    }),
]);

export const transactionFilterSchema = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional().nullable(),
  accountId: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

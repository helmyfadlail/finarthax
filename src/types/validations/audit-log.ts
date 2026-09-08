import { z } from "zod";

export const auditLogFilterSchema = z.object({
  entityType: z.enum(["account", "transaction", "budget", "goal"]).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

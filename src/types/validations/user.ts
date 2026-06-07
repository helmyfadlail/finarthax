import z from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  avatar: z.string("Invalid avatar URL").optional().nullable(),
  avatarFileId: z.string().optional().nullable(),
});

export const updateNotificationsSchema = z.object({
  emailNotifications: z.boolean().optional().nullable(),
  transactionAlerts: z.boolean().optional().nullable(),
  budgetAlerts: z.boolean().optional().nullable(),
  weeklyReport: z.boolean().optional().nullable(),
  marketingEmails: z.boolean().optional().nullable(),
});

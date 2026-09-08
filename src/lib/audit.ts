import { Prisma } from "prisma-client/client";
import { prisma } from "@/lib";
import { logger } from "./logger";

export type AuditEntityType = "account" | "transaction" | "budget" | "goal";

interface AuditLogEntry {
  entityType: AuditEntityType;
  entityId: string;
  action: "create" | "update" | "delete";
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  actor: { id: string; email: string };
}

/**
 * Records who changed a piece of financial data and what it held before.
 *
 * Mirrors `recordAppSettingAudit` in src/lib/app-settings.ts: a failure to write the audit must
 * never fail the mutation it is describing, so it is logged and dropped.
 */
export const recordAuditLog = async ({ entityType, entityId, action, previousValue = null, newValue = null, actor }: AuditLogEntry): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        previousValue: (previousValue ?? undefined) as Prisma.InputJsonValue | undefined,
        newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
        actorId: actor.id,
        actorEmail: actor.email,
      },
    });
  } catch (error) {
    logger.error("audit.record_failed", { entityType, entityId, action, err: error });
  }
};

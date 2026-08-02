import { NextRequest } from "next/server";
import { advanceToFuture, diffInDays, prisma, requireAuth, TRANSACTION_INCLUDE, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { id } = await params;

      const transaction = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
      if (!transaction) return errorResponse("Transaction not found", 404);

      const interval = transaction.recurrenceInterval;
      if (!interval) return errorResponse("This transaction is not part of a recurring series", 422);

      const nextOccurrence = advanceToFuture(transaction.nextOccurrence ?? transaction.date, interval);
      const isFinished = transaction.recurrenceEndDate !== null && diffInDays(transaction.recurrenceEndDate, nextOccurrence) > 0;

      const updated = await prisma.transaction.update({
        where: { id },
        data: { nextOccurrence: isFinished ? null : nextOccurrence },
        include: TRANSACTION_INCLUDE,
      });

      return successResponse(updated, isFinished ? "Occurrence skipped — the series has reached its end date" : "Occurrence skipped");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

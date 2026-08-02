import { NextRequest } from "next/server";
import { findSeriesSiblings, prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

const setDismissedAt = async (userId: string, id: string, dismissedAt: Date | null) => {
  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) return null;

  const siblings = await findSeriesSiblings(userId, transaction);

  await prisma.transaction.updateMany({
    where: { id: { in: siblings.map((sibling) => sibling.id) } },
    data: { recurrenceDismissedAt: dismissedAt },
  });

  return siblings.length;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { id } = await params;

      const affected = await setDismissedAt(user.id, id, new Date());
      if (affected === null) return errorResponse("Transaction not found", 404);

      return successResponse({ affected }, "Suggestion dismissed");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      const { id } = await params;

      const affected = await setDismissedAt(user.id, id, null);
      if (affected === null) return errorResponse("Transaction not found", 404);

      return successResponse({ affected }, "Suggestion restored");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

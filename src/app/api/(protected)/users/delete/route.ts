import { NextRequest } from "next/server";

import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse } from "@/utils";

export async function DELETE(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();

      await prisma.user.delete({ where: { id: user.id } });

      return successResponse(null, "Account deleted successfully");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

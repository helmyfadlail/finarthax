import { NextRequest } from "next/server";
import { confirmOccurrence, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { confirmRecurringSchema } from "@/types";

export const POST = withApi<{ id: string }>("recurring.confirm", async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const validation = confirmRecurringSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  // The write itself is shared with the public quick-entry page - see src/lib/recurring-actions.ts.
  const result = await confirmOccurrence(user.id, id, validation.data);
  if (result.error) return errorResponse(result.error, result.status ?? 400);

  return successResponse(result.transaction, result.message);
});

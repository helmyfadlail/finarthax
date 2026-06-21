import { NextRequest } from "next/server";
import { withMaintenanceGuard } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  return withMaintenanceGuard(req, async () => {
    try {
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

      if (!privateKey) {
        return errorResponse("ImageKit private key is not configured.", 500);
      }

      const { fileId } = await params;

      if (!fileId || fileId.trim() === "") return errorResponse("`fileId` path parameter is required.", 400);

      const basicAuth = Buffer.from(`${privateKey}:`).toString("base64");

      const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${basicAuth}` },
      });

      if (response.status === 204) {
        return successResponse({ success: true, message: "File deleted successfully" });
      }

      const data = await response.json().catch(() => ({}));

      return errorResponse(data.message || "Failed to delete file from ImageKit", response.status);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

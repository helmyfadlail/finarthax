import { NextRequest } from "next/server";
import { logger, withApi } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export const DELETE = withApi<{ fileId: string }>("imagekit.delete", async (req: NextRequest, { params }) => {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!privateKey) {
    logger.error("imagekit.not_configured", { hasPrivateKey: false });
    return errorResponse("ImageKit private key is not configured.", 500);
  }

  const { fileId } = await params;

  if (!fileId || fileId.trim() === "") return errorResponse("`fileId` path parameter is required.", 400);

  const basicAuth = Buffer.from(`${privateKey}:`).toString("base64");

  const done = logger.time("imagekit.delete.upstream", { fileId });

  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${basicAuth}` },
  });

  done({ status: response.status });

  if (response.status === 204) {
    logger.info("imagekit.deleted", { fileId });
    return successResponse({ success: true, message: "File deleted successfully" });
  }

  const data = await response.json().catch(() => ({}));

  // Third-party failures are the hardest to reproduce later - record what ImageKit said.
  logger.error("imagekit.delete_failed", { fileId, status: response.status, upstreamMessage: data.message });

  return errorResponse(data.message || "Failed to delete file from ImageKit", response.status);
});

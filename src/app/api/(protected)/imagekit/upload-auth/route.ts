import { NextRequest } from "next/server";

import { getUploadAuthParams } from "@imagekit/next/server";

import { requireAuth, withMaintenanceGuard } from "@/lib";

import { errorResponse, successResponse } from "@/utils";

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      await requireAuth();

      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
      const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
      const expireSeconds = Math.min(Number(process.env.IMAGEKIT_UPLOAD_EXPIRE_SEC), 3600);

      const expiration = Math.floor(Date.now() / 1000) + expireSeconds;

      if (!privateKey || !publicKey) return errorResponse("ImageKit keys are not configured properly.", 500);

      const { token, expire, signature } = getUploadAuthParams({
        privateKey,
        publicKey,
        expire: expiration,
      });

      return successResponse({ token, expire, signature, publicKey });
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
      return errorResponse(error instanceof Error ? error.message : "An unexpected error occurred", 500);
    }
  });
}

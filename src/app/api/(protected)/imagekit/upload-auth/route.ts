import { getUploadAuthParams } from "@imagekit/next/server";
import { logger, requireAuth, withApi } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

export const GET = withApi("imagekit.upload_auth", async () => {
  await requireAuth();

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const expireSeconds = Math.min(Number(process.env.IMAGEKIT_UPLOAD_EXPIRE_SEC), 3600);

  const expiration = Math.floor(Date.now() / 1000) + expireSeconds;

  if (!privateKey || !publicKey) {
    // A misconfigured deploy fails every upload, so name the missing variable.
    logger.error("imagekit.not_configured", { hasPrivateKey: Boolean(privateKey), hasPublicKey: Boolean(publicKey) });
    return errorResponse("ImageKit keys are not configured properly.", 500);
  }

  const { token, expire, signature } = getUploadAuthParams({
    privateKey,
    publicKey,
    expire: expiration,
  });

  logger.debug("imagekit.upload_auth_issued", { expiresInSeconds: expireSeconds });

  return successResponse({ token, expire, signature, publicKey });
});

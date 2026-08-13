import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { setRequestUser } from "./request-context";

export const getCurrentUser = async () => {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user ?? null;

    // Stamp the id onto the request context so every later log line - the response
    // line, a slow query, an unhandled error - is attributable to this user.
    if (user?.id) setRequestUser(user.id);

    return user;
  } catch (error) {
    logger.error("auth.session_failed", { err: error });
    return null;
  }
};

export const requireAuth = async () => {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    throw new Error("Unauthorized");
  }

  return user;
};

export const getUserId = async (): Promise<string> => {
  const user = await requireAuth();
  return user.id;
};

/**
 * The guard for anything that changes the instance itself rather than one account's data.
 *
 * The role is re-read from the database instead of trusted from the session, so a demotion takes
 * effect on the next request even though the JWT it was minted into is still valid.
 */
export const requireSuperAdmin = async () => {
  const user = await requireAuth();

  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, role: true } });

  if (current?.role !== "SUPERADMIN") {
    logger.warn("auth.forbidden", { targetUserId: user.id, required: "SUPERADMIN", actual: current?.role ?? "unknown" });
    throw new Error("Forbidden");
  }

  return current;
};

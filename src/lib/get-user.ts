import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { setRequestUser } from "./request-context";

export const getCurrentUser = async () => {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user ?? null;

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

export const requireSuperAdmin = async () => {
  const user = await requireAuth();

  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, role: true } });

  if (current?.role !== "SUPERADMIN") {
    logger.warn("auth.forbidden", { targetUserId: user.id, required: "SUPERADMIN", actual: current?.role ?? "unknown" });
    throw new Error("Forbidden");
  }

  return current;
};

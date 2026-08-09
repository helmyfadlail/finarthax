import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { logger } from "./logger";
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

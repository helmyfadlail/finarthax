import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extend Session to include user.id
   */
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      avatar?: string | null;
      avatarFileId?: string | null;
      email_verified?: string | null;
    };
  }

  /**
   * Extend User to include id
   */
  interface User {
    id: string;
    email: string;
    name?: string | null;
    avatar?: string | null;
    avatarFileId?: string | null;
    email_verified?: string | null;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extend JWT to include user.id
   */
  interface JWT {
    id: string;
    email: string;
    name?: string | null;
    avatar?: string | null;
    avatarFileId?: string | null;
    email_verified?: string | null;
  }
}

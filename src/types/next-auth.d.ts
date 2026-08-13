import "next-auth";
import "next-auth/jwt";

type UserRole = "USER" | "SUPERADMIN";

declare module "next-auth" {
  /**
   * Extend Session to include user.id
   */
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
      avatar?: string | null;
      avatarFileId?: string | null;
      email_verified?: string | null;
      passwordChangedAt?: Date | null;
      passwordExpiresAt?: Date | null;
    };
  }

  /**
   * Extend User to include id
   */
  interface User {
    id: string;
    email: string;
    name: string | null;
    role?: UserRole;
    avatar?: string | null;
    avatarFileId?: string | null;
    email_verified?: string | null;
    passwordChangedAt?: Date | null;
    passwordExpiresAt?: Date | null;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extend JWT to include user.id
   */
  interface JWT {
    id: string;
    email: string;
    name: string | null;
    role?: UserRole;
    avatar?: string | null;
    avatarFileId?: string | null;
    email_verified?: string | null;
    passwordChangedAt?: Date | null;
    passwordExpiresAt?: Date | null;
  }
}

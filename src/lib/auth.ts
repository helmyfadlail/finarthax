import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });

        if (!user) throw new Error("Email is not registered.");

        if (!user.password) throw new Error("This account uses Google login. Please sign in with Google.");

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) throw new Error("Incorrect password.");

        if (user.password && user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
          throw new Error("Your password has expired. Please reset your password to continue.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
          avatarFileId: user.avatarFileId,
          passwordChangedAt: user.passwordChangedAt,
          passwordExpiresAt: user.passwordExpiresAt,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.SESSION_EXPIRATION!) || 15 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.avatar = user.avatar;
        token.avatarFileId = user.avatarFileId;
        token.passwordChangedAt = user.passwordChangedAt;
        token.passwordExpiresAt = user.passwordExpiresAt;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.email) {
        const user = await prisma.user.findUnique({ where: { email: token.email as string } });

        if (!user) return { ...session, user: undefined };

        if (user.password && user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
          return { ...session, user: undefined };
        }

        if (session.user) {
          session.user.id = user.id;
          session.user.name = user.name;
          session.user.email = user.email;
          session.user.avatar = user.avatar;
          session.user.avatarFileId = user.avatarFileId;
          session.user.passwordChangedAt = user.passwordChangedAt;
          session.user.passwordExpiresAt = user.passwordExpiresAt;
        }
      }
      return session;
    },

    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        const name = user.name;

        if (!email || !name) return false;

        let existingUser = await prisma.user.findUnique({ where: { email } });

        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              email,
              name,
              avatar: user.image,
              emailVerified: new Date(),
            },
          });

          await prisma.category.createMany({
            data: [
              { userId: existingUser.id, name: "Salary", type: "INCOME", icon: "💰", color: "#10B981", isDefault: true },
              { userId: existingUser.id, name: "Bonus", type: "INCOME", icon: "🎁", color: "#3B82F6", isDefault: true },
              { userId: existingUser.id, name: "Freelance", type: "INCOME", icon: "💼", color: "#F59E0B", isDefault: true },
              { userId: existingUser.id, name: "Others", type: "INCOME", icon: "💵", color: "#6B7280", isDefault: true },

              { userId: existingUser.id, name: "Food & Drinks", type: "EXPENSE", icon: "🍔", color: "#EF4444", isDefault: true },
              { userId: existingUser.id, name: "Transportation", type: "EXPENSE", icon: "🚗", color: "#F59E0B", isDefault: true },
              { userId: existingUser.id, name: "Shopping", type: "EXPENSE", icon: "🛒", color: "#8B5CF6", isDefault: true },
              { userId: existingUser.id, name: "Entertainment", type: "EXPENSE", icon: "🎬", color: "#EC4899", isDefault: true },
              { userId: existingUser.id, name: "Bills", type: "EXPENSE", icon: "📄", color: "#6366F1", isDefault: true },
              { userId: existingUser.id, name: "Healthcare", type: "EXPENSE", icon: "⚕️", color: "#14B8A6", isDefault: true },
            ],
          });

          await prisma.account.create({
            data: {
              userId: existingUser.id,
              name: "Cash",
              type: "CASH",
              balance: 0,
              isDefault: true,
              color: "#10B981",
              icon: "💵",
            },
          });
        }

        user.id = existingUser.id;
      }
      return true;
    },
  },

  pages: {
    signIn: "/login",
    error: "/error",
  },

  debug: process.env.NODE_ENV === "development",
};

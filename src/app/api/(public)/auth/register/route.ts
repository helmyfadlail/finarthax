import { NextRequest } from "next/server";
import { logger, prisma, withApi, getMaxPasswordAgeDays, calculatePasswordExpiresAt } from "@/lib";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import { registerSchema } from "@/types";
import z from "zod";
import bcrypt from "bcryptjs";

export const POST = withApi("auth.register", async (req: NextRequest) => {
  const body = await req.json();
  const validation = registerSchema.safeParse(body);

  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const allowedRegistrationSetting = await prisma.appSetting.findFirst({ where: { key: "allow_registration" } });

  if (!allowedRegistrationSetting?.value) {
    logger.warn("auth.register_blocked", { reason: "registration_disabled" });
    return errorResponse("Registration is currently disabled", 403);
  }

  const { email, password, name } = validation.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    logger.warn("auth.register_rejected", { reason: "email_taken", email });
    return errorResponse("Email already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const maxPasswordAgeDays = await getMaxPasswordAgeDays();
  const now = new Date();
  const passwordExpiresAt = calculatePasswordExpiresAt(now, maxPasswordAgeDays);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        avatar: null,
        emailVerified: null,
        passwordChangedAt: now,
        passwordExpiresAt,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        passwordChangedAt: true,
        passwordExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.category.createMany({
      data: [
        { userId: user.id, name: "Salary", type: "INCOME", icon: "💰", color: "#16a34a", isDefault: true },
        { userId: user.id, name: "Bonus", type: "INCOME", icon: "🎁", color: "#0284c7", isDefault: true },
        { userId: user.id, name: "Freelance", type: "INCOME", icon: "💼", color: "#ca8a04", isDefault: true },
        { userId: user.id, name: "Others", type: "INCOME", icon: "💵", color: "#64748b", isDefault: true },

        { userId: user.id, name: "Food & Drinks", type: "EXPENSE", icon: "🍔", color: "#dc2626", isDefault: true },
        { userId: user.id, name: "Transportation", type: "EXPENSE", icon: "🚗", color: "#ea580c", isDefault: true },
        { userId: user.id, name: "Shopping", type: "EXPENSE", icon: "🛒", color: "#7c3aed", isDefault: true },
        { userId: user.id, name: "Entertainment", type: "EXPENSE", icon: "🎬", color: "#db2777", isDefault: true },
        { userId: user.id, name: "Bills", type: "EXPENSE", icon: "📄", color: "#4f46e5", isDefault: true },
        { userId: user.id, name: "Healthcare", type: "EXPENSE", icon: "⚕️", color: "#0d9488", isDefault: true },
      ],
    });

    await tx.account.create({
      data: {
        userId: user.id,
        name: "Cash",
        type: "CASH",
        balance: 0,
        isDefault: true,
        color: "#16a34a",
        icon: "💵",
      },
    });

    return user;
  });

  // Signup seeds default categories and a cash account in the same transaction -
  // a partial account is impossible, but this line proves the whole thing ran.
  logger.info("auth.registered", { newUserId: result.id, email });

  return successResponse(result, "Registration successful");
});

import { prisma } from "@/lib";

export const TRANSACTION_INCLUDE = {
  category: true,
  account: true,
  toAccount: true,
} as const;

export const validateAccount = async (userId: string, accountId: string, toAccountId?: string) => {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return { error: "Source account not found", account: null };

  if (toAccountId) {
    const toAccount = await prisma.account.findFirst({ where: { id: toAccountId, userId } });
    if (!toAccount) return { error: "Destination account not found", account: null };
  }

  return { error: null, account };
};

export const validateCategory = async (userId: string, categoryId?: string) => {
  if (!categoryId) return { error: null };
  const category = await prisma.category.findFirst({ where: { id: categoryId, OR: [{ userId }, { isDefault: true }] } });
  if (!category) return { error: "Category not found" };
  return { error: null };
};

export const validateCreditCardRules = async (accountId: string, type: string, toAccountId?: string | null): Promise<string | null> => {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { type: true } });

  if (account?.type !== "CREDIT_CARD") return null;

  if (type === "INCOME") {
    return "Income transactions are not allowed on a credit card account. " + "To reduce your credit card balance, transfer money from a bank account to the credit card.";
  }

  if (type === "TRANSFER" && !toAccountId) {
    return "A transfer from a credit card requires a destination account.";
  }

  return null;
};

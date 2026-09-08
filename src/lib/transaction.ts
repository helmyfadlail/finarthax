import { prisma } from "@/lib";

export const TRANSACTION_INCLUDE = {
  category: true,
  account: true,
  toAccount: true,
  tags: true,
} as const;

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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

export const validateTags = async (userId: string, tagIds?: string[]): Promise<{ error: string | null }> => {
  if (!tagIds || tagIds.length === 0) return { error: null };
  const count = await prisma.tag.count({ where: { id: { in: tagIds }, userId } });
  if (count !== tagIds.length) return { error: "One or more tags were not found" };
  return { error: null };
};

/**
 * A transfer between accounts held in different currencies needs a rate to know how much lands
 * in the destination account. It is entered by hand rather than looked up live: a transfer is a
 * settled, historical event, and repricing it with today's rate would misstate what actually
 * happened at the time.
 */
export const resolveTransferExchangeRate = async (accountId: string, toAccountId: string | null | undefined, exchangeRate?: number): Promise<{ error: string | null; exchangeRate: number | null }> => {
  if (!toAccountId) return { error: null, exchangeRate: null };

  const [source, destination] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { currency: true } }),
    prisma.account.findUnique({ where: { id: toAccountId }, select: { currency: true } }),
  ]);

  if (!source || !destination || source.currency === destination.currency) return { error: null, exchangeRate: null };

  if (!exchangeRate) return { error: `An exchange rate is required for a transfer from ${source.currency} to ${destination.currency}`, exchangeRate: null };

  return { error: null, exchangeRate };
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

export const applyBalanceChange = async (
  tx: TxClient,
  transaction: {
    type: string;
    accountId: string;
    toAccountId?: string | null;
    amount: { toNumber(): number } | number;
    /** Set only for a transfer whose source and destination accounts hold different currencies. */
    convertedAmount?: { toNumber(): number } | number | null;
  },
  direction: "apply" | "reverse",
) => {
  const amount = typeof transaction.amount === "number" ? transaction.amount : transaction.amount.toNumber();

  const multiplier = direction === "reverse" ? -1 : 1;

  if (transaction.type === "TRANSFER") {
    // The destination side moves by the converted amount when currencies differ, and by the
    // same `amount` otherwise - so an ordinary same-currency transfer is unaffected.
    const destAmount = transaction.convertedAmount != null ? (typeof transaction.convertedAmount === "number" ? transaction.convertedAmount : transaction.convertedAmount.toNumber()) : amount;

    await tx.account.update({ where: { id: transaction.accountId }, data: { balance: { increment: -amount * multiplier } } });
    if (transaction.toAccountId) {
      await tx.account.update({ where: { id: transaction.toAccountId }, data: { balance: { increment: destAmount * multiplier } } });
    }
  } else {
    const change = transaction.type === "INCOME" ? amount : -amount;
    await tx.account.update({ where: { id: transaction.accountId }, data: { balance: { increment: change * multiplier } } });
  }
};

export const applyBudgetChange = async (
  tx: TxClient,
  userId: string,
  transaction: {
    type: string;
    categoryId?: string | null;
    amount: { toNumber(): number } | number;
    date: Date | string;
  },
  direction: "apply" | "reverse",
) => {
  if (transaction.type !== "EXPENSE" || !transaction.categoryId) return;

  const amount = typeof transaction.amount === "number" ? transaction.amount : transaction.amount.toNumber();

  const date = new Date(transaction.date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  await tx.budget.updateMany({
    where: { userId, categoryId: transaction.categoryId, month, year },
    data: { spent: direction === "apply" ? { increment: amount } : { decrement: amount } },
  });
};

import { prisma } from "@/lib";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Balance helpers
// ---------------------------------------------------------------------------

/**
 * Applies or reverses the balance impact of a transaction.
 *
 * All accounts use the same arithmetic direction:
 *   INCOME            → balance += amount
 *   EXPENSE           → balance -= amount
 *   TRANSFER (source) → balance -= amount  (money leaves)
 *   TRANSFER (dest)   → balance += amount  (money arrives)
 *
 * Credit card accounts store balance as a NEGATIVE number (liability convention):
 *   - Starts at 0 (fully paid off)
 *   - EXPENSE makes it more negative (more debt)
 *   - TRANSFER as destination (payment) makes it less negative (less debt)
 *   - TRANSFER as source (cash advance) makes it more negative (more debt)
 *
 * Because the arithmetic is the same for all accounts, no branching is needed
 * on account type — the negative convention handles it automatically.
 *
 * The `direction` parameter allows the same function to be used for both
 * applying a new transaction and reversing an existing one (for edit/delete).
 */
export const applyBalanceChange = async (
  tx: TxClient,
  transaction: {
    type: string;
    accountId: string;
    toAccountId?: string | null;
    amount: { toNumber(): number } | number;
  },
  direction: "apply" | "reverse",
) => {
  const amount = typeof transaction.amount === "number" ? transaction.amount : transaction.amount.toNumber();

  const multiplier = direction === "reverse" ? -1 : 1;

  if (transaction.type === "TRANSFER") {
    await tx.account.update({ where: { id: transaction.accountId }, data: { balance: { increment: -amount * multiplier } } });
    if (transaction.toAccountId) {
      await tx.account.update({ where: { id: transaction.toAccountId }, data: { balance: { increment: amount * multiplier } } });
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

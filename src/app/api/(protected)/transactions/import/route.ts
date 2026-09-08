import Papa from "papaparse";
import { applyBalanceChange, applyBudgetChange, logger, prisma, recordAuditLog, requireAuth, TRANSACTION_INCLUDE, withApi } from "@/lib";
import { errorResponse, successResponse } from "@/utils";

interface ImportError {
  row: number;
  message: string;
}

interface ResolvedRow {
  row: number;
  date: Date;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  description: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  tagIds: string[];
}

const VALID_TYPES = new Set(["INCOME", "EXPENSE", "TRANSFER"]);

/** Column names match the CSV this app exports, matched case- and whitespace-insensitively. */
const normalizeHeader = (header: string): string => header.trim().toLowerCase();

export const POST = withApi("transactions.import", async (req) => {
  const user = await requireAuth();

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") return errorResponse("A CSV file is required", 400);

  const text = await file.text();

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  if (parsed.errors.length > 0) {
    return errorResponse(`Could not parse the CSV file: ${parsed.errors[0].message}`, 422);
  }

  const [accounts, categories, tags] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true, type: true } }),
    prisma.category.findMany({ where: { OR: [{ userId: user.id }, { isDefault: true }] }, select: { id: true, name: true, type: true } }),
    prisma.tag.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);

  const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const tagByName = new Map(tags.map((t) => [t.name.toLowerCase(), t]));
  const tagsToCreate = new Map<string, string>();

  const errors: ImportError[] = [];
  const resolved: ResolvedRow[] = [];

  parsed.data.forEach((raw, index) => {
    const row = index + 2; // +1 for the header row, +1 to make it 1-indexed

    const typeRaw = (raw.type ?? "").trim().toUpperCase();
    const dateRaw = (raw.date ?? "").trim();
    const amountRaw = (raw.amount ?? "").trim();
    const accountRaw = (raw.account ?? "").trim();
    const toAccountRaw = (raw["to account"] ?? "").trim();
    const categoryRaw = (raw.category ?? "").trim();
    const tagsRaw = (raw.tags ?? "").trim();

    if (!VALID_TYPES.has(typeRaw)) {
      errors.push({ row, message: `Unknown type "${raw.type ?? ""}" (expected INCOME, EXPENSE, or TRANSFER)` });
      return;
    }

    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      errors.push({ row, message: `Invalid date "${dateRaw}"` });
      return;
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ row, message: `Invalid amount "${amountRaw}"` });
      return;
    }

    const account = accountByName.get(accountRaw.toLowerCase());
    if (!account) {
      errors.push({ row, message: `Account "${accountRaw}" was not found` });
      return;
    }

    let toAccountId: string | null = null;
    if (typeRaw === "TRANSFER" && toAccountRaw) {
      const toAccount = accountByName.get(toAccountRaw.toLowerCase());
      if (!toAccount) {
        errors.push({ row, message: `Destination account "${toAccountRaw}" was not found` });
        return;
      }
      toAccountId = toAccount.id;
    }

    let categoryId: string | null = null;
    if (typeRaw !== "TRANSFER") {
      if (!categoryRaw) {
        errors.push({ row, message: "Category is required for income/expense rows" });
        return;
      }
      const category = categoryByName.get(categoryRaw.toLowerCase());
      if (!category) {
        errors.push({ row, message: `Category "${categoryRaw}" was not found` });
        return;
      }
      categoryId = category.id;
    }

    const tagNames = tagsRaw
      ? tagsRaw
          .split(";")
          .map((name) => name.trim())
          .filter(Boolean)
      : [];

    for (const name of tagNames) {
      if (!tagByName.has(name.toLowerCase())) tagsToCreate.set(name.toLowerCase(), name);
    }

    resolved.push({ row, date, type: typeRaw as ResolvedRow["type"], amount, description: (raw.description ?? "").trim(), accountId: account.id, toAccountId, categoryId, tagIds: tagNames.map((n) => n.toLowerCase()) });
  });

  if (tagsToCreate.size > 0) {
    await prisma.tag.createMany({ data: [...tagsToCreate.values()].map((name) => ({ userId: user.id, name })), skipDuplicates: true });
    const created = await prisma.tag.findMany({ where: { userId: user.id, name: { in: [...tagsToCreate.values()] } }, select: { id: true, name: true } });
    for (const tag of created) tagByName.set(tag.name.toLowerCase(), tag);
  }

  let created = 0;

  if (resolved.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const row of resolved) {
        const tagIds = row.tagIds.map((name) => tagByName.get(name)?.id).filter((id): id is string => !!id);

        const transaction = await tx.transaction.create({
          data: {
            userId: user.id,
            accountId: row.accountId,
            toAccountId: row.toAccountId,
            categoryId: row.categoryId,
            amount: row.amount,
            type: row.type,
            description: row.description || undefined,
            date: row.date,
            isRecurring: false,
            recurrenceInterval: null,
            recurrenceKey: null,
            nextOccurrence: null,
            ...(tagIds.length > 0 && { tags: { connect: tagIds.map((id) => ({ id })) } }),
          },
          include: TRANSACTION_INCLUDE,
        });

        await applyBalanceChange(tx, { type: row.type, accountId: row.accountId, toAccountId: row.toAccountId, amount: row.amount }, "apply");
        await applyBudgetChange(tx, user.id, { type: row.type, categoryId: row.categoryId, amount: row.amount, date: row.date }, "apply");

        await recordAuditLog({
          entityType: "transaction",
          entityId: transaction.id,
          action: "create",
          newValue: { type: transaction.type, amount: row.amount, accountId: transaction.accountId, source: "csv_import" },
          actor: user,
        });

        created += 1;
      }
    });
  }

  logger.info("transactions.imported", { created, skipped: errors.length });

  return successResponse({ created, skipped: errors.length, errors }, `Imported ${created} transaction${created === 1 ? "" : "s"}`);
});

import { NextRequest, NextResponse } from "next/server";
import { logger, prisma, requireAuth, withApi } from "@/lib";
import { Prisma } from "prisma-client/client";
import { validationErrorResponse } from "@/utils";
import z from "zod";
import { transactionFilterSchema } from "@/types";

const CSV_HEADERS = ["Date", "Type", "Amount", "Description", "Category", "Account", "To Account", "Tags"] as const;

/** Quotes a field only when it needs it, matching how spreadsheet apps write CSV. */
const csvField = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const csvRow = (fields: string[]): string => fields.map(csvField).join(",") + "\r\n";

export const GET = withApi("transactions.export", async (req: NextRequest) => {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);

  const filterData = {
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    type: searchParams.get("type") || undefined,
    accountId: searchParams.get("accountId") || undefined,
    tagId: searchParams.get("tagId") || undefined,
    search: searchParams.get("search") || undefined,
    page: 1,
    limit: 1,
  };

  const validation = transactionFilterSchema.safeParse(filterData);
  if (!validation.success) {
    const { fieldErrors } = z.flattenError(validation.error);
    return validationErrorResponse(fieldErrors);
  }

  const { startDate, endDate, categoryId, type, accountId, tagId, search } = validation.data;

  // Same filter shape as the list endpoint, minus pagination - an export is always the full match.
  const where: Prisma.TransactionWhereInput = {
    userId: user.id,
    ...(startDate || endDate ? { date: { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) } } : {}),
    ...(categoryId && { categoryId }),
    ...(type && { type }),
    ...(accountId && { accountId }),
    ...(tagId && { tags: { some: { id: tagId } } }),
    ...(search && { description: { contains: search, mode: "insensitive" } }),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, account: true, toAccount: true, tags: true },
    orderBy: { date: "desc" },
  });

  let csv = csvRow([...CSV_HEADERS]);
  for (const t of transactions) {
    csv += csvRow([
      new Date(t.date).toISOString(),
      t.type,
      t.amount.toString(),
      t.description ?? "",
      t.category?.name ?? "",
      t.account?.name ?? "",
      t.toAccount?.name ?? "",
      t.tags.map((tag) => tag.name).join("; "),
    ]);
  }

  logger.info("transactions.exported", { count: transactions.length });

  const filename = `transactions-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
});

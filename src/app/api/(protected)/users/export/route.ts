import { NextResponse } from "next/server";
import { buildFinancialReport, logger, PdfPaginationError, prisma, requireAuth, withApi } from "@/lib";
import type { ReportResult, ReportTransaction } from "@/lib";
import { errorResponse } from "@/utils";

export const GET = withApi("users.export", async () => {
  const user = await requireAuth();

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      transactions: {
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
          type: true,
          amount: true,
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      },
    },
  });

  if (!userData) return errorResponse("User not found", 404);

  const transactions: ReportTransaction[] = userData.transactions.map((t) => ({ ...t, amount: Number(t.amount) }));

  const done = logger.time("users.export.render_pdf", { transactions: transactions.length });

  let report: ReportResult;
  try {
    report = await buildFinancialReport(userData, transactions);
  } catch (error) {
    logger.error("users.export_failed", { transactions: transactions.length, kind: error instanceof PdfPaginationError ? "pagination" : "render", err: error });

    if (error instanceof Error && error.message.startsWith("Font")) return errorResponse(error.message, 500);

    return errorResponse("We could not generate your PDF report. Please try again, and contact support if it keeps failing.", 500);
  }

  done({ bytes: report.buffer.byteLength, pages: report.pages });

  const filename = `report-${new Date().toISOString().split("T")[0]}.pdf`;

  logger.info("users.exported", { transactions: transactions.length, pages: report.pages, bytes: report.buffer.byteLength });

  return new NextResponse(new Uint8Array(report.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(report.buffer.byteLength),
      "X-Report-Pages": String(report.pages),
      "Cache-Control": "no-store",
    },
  });
});

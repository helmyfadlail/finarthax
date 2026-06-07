import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { prisma, requireAuth, withMaintenanceGuard } from "@/lib";
import { errorResponse, formattedCurrency } from "@/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const MARGIN = 50;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C = {
  primary: "#1e293b",
  secondary: "#475569",
  accent: "#3b82f6",
  success: "#10b981",
  danger: "#ef4444",
  light: "#f1f5f9",
  white: "#ffffff",
} as const;

const COLS = [
  { label: "Date", x: 55, w: 70 },
  { label: "Type", x: 135, w: 60 },
  { label: "Category", x: 205, w: 110 },
  { label: "Account", x: 325, w: 120 },
  { label: "Amount", x: 455, w: 90 },
] as const;

const ROW_H = 18;
const HEADER_H = 25;
const FOOTER_H = 40;
const SAFE_BOTTOM = PAGE_H - FOOTER_H - ROW_H;

const FONT = "SpaceGrotesk";

const FONT_BUFFER = (() => {
  const filename = "SpaceGrotesk-Regular.ttf";
  const candidate = path.join(process.cwd(), "public", "fonts", filename);
  if (!fs.existsSync(candidate)) throw new Error(`Font not found: ${candidate}. Commit public/fonts/${filename}.`);
  return fs.readFileSync(candidate);
})();

interface Transaction {
  id: string;
  date: Date;
  type: string;
  amount: number;
  category?: { name: string } | null;
  account?: { name: string } | null;
}

const sum = (txs: Transaction[], type: string) => txs.filter((t) => t.type === type).reduce((acc, t) => acc + t.amount, 0);

const topCategories = (txs: Transaction[], limit = 5): [string, number][] => {
  const totals: Record<string, number> = {};
  txs
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => {
      const key = t.category?.name ?? "Uncategorized";
      totals[key] = (totals[key] ?? 0) + t.amount;
    });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
};

const drawSectionHeader = (doc: PDFKit.PDFDocument, title: string, color: string) => {
  const y = doc.y;
  doc
    .save()
    .fillColor(C.light)
    .rect(MARGIN, y, CONTENT_W, 28)
    .fill()
    .fillColor(color)
    .rect(MARGIN, y, 4, 28)
    .fill()
    .restore()
    .fillColor(C.primary)
    .fontSize(12)
    .font(FONT)
    .text(title, MARGIN + 14, y + 8, { width: CONTENT_W - 20 });
  doc.y = y + 36;
};

const drawTableHeader = (doc: PDFKit.PDFDocument) => {
  const y = doc.y;
  doc.save().fillColor(C.primary).rect(MARGIN, y, CONTENT_W, 20).fill().fillColor(C.white).fontSize(9);
  COLS.forEach((col) => doc.text(col.label, col.x, y + 6, { width: col.w }));
  doc.restore();
  doc.y = y + HEADER_H;
};

const drawTableRow = (doc: PDFKit.PDFDocument, t: Transaction, idx: number) => {
  const y = doc.y;

  if (idx % 2 === 0) {
    doc.save().fillColor(C.light).rect(MARGIN, y, CONTENT_W, ROW_H).fill().restore();
  }

  const date = new Date(t.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  doc.fontSize(9).font(FONT).fillColor(C.secondary);
  doc.text(date, COLS[0].x, y + 4, { width: COLS[0].w });
  doc.text(t.type, COLS[1].x, y + 4, { width: COLS[1].w });
  doc.text(t.category?.name ?? "—", COLS[2].x, y + 4, { width: COLS[2].w });
  doc.text(t.account?.name ?? "—", COLS[3].x, y + 4, { width: COLS[3].w });
  doc.fillColor(t.type === "INCOME" ? C.success : C.danger).text(formattedCurrency(t.amount), COLS[4].x, y + 4, { width: COLS[4].w });

  doc.y = y + ROW_H;
};

const buildPDF = (user: { name: string | null; email: string | null }, transactions: Transaction[]): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "A4", bufferPages: true });
    doc.registerFont(FONT, FONT_BUFFER).font(FONT);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const income = sum(transactions, "INCOME");
    const expense = sum(transactions, "EXPENSE");
    const balance = income - expense;
    const savings = income > 0 ? ((income - expense) / income) * 100 : 0;

    const sorted = [...transactions].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const firstDate = sorted.at(0)?.date ?? new Date();
    const lastDate = sorted.at(-1)?.date ?? new Date();

    doc.fillColor(C.primary).fontSize(26).text("Financial Report", { align: "center" });
    doc
      .moveDown(0.3)
      .fontSize(10)
      .fillColor(C.secondary)
      .text(`Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`, { align: "center" });
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor(C.secondary);
    doc.text(`User: ${user.name ?? "Unknown"}`, MARGIN);
    doc.text(`Email: ${user.email ?? "N/A"}`, MARGIN);
    doc.text(`Period: ${new Date(firstDate).toLocaleDateString()} – ${new Date(lastDate).toLocaleDateString()}`, MARGIN);
    doc.moveDown(1.5);

    drawSectionHeader(doc, "Financial Summary", C.accent);

    const summaryY = doc.y;
    const LX = 70,
      VX = 320;

    const summaryRows: [string, string, string][] = [
      ["Total Income", formattedCurrency(income), C.success],
      ["Total Expenses", formattedCurrency(expense), C.danger],
      ["Net Balance", formattedCurrency(balance), balance >= 0 ? C.success : C.danger],
      ["Savings Rate", `${savings.toFixed(1)}%`, C.primary],
    ];

    summaryRows.forEach(([label, value, color], i) => {
      const ry = summaryY + i * 26;
      doc.fontSize(11).fillColor(C.secondary).text(label, LX, ry);
      doc.fillColor(color).text(value, VX, ry, { align: "right", width: 200 });
    });

    doc.y = summaryY + summaryRows.length * 26 + 20;
    doc.moveDown(1.5);

    const cats = topCategories(transactions);
    if (cats.length > 0) {
      drawSectionHeader(doc, "Top Spending Categories", C.success);
      cats.forEach(([name, total], i) => {
        const iy = doc.y;
        doc
          .fontSize(10)
          .fillColor(C.secondary)
          .text(`${i + 1}. ${name}`, LX, iy, { width: 300 });
        doc.fillColor(C.primary).text(formattedCurrency(total), LX, iy, { align: "right", width: 450 });
        doc.y = iy + 24;
      });
    }

    doc.addPage();
    doc.fillColor(C.primary).fontSize(16).text("Transaction History", MARGIN, MARGIN);
    doc.moveDown(1);

    if (transactions.length === 0) {
      doc.fontSize(11).fillColor(C.secondary).text("No transactions found.", { align: "center" });
    } else {
      drawTableHeader(doc);

      transactions.forEach((t, idx) => {
        if (doc.y + ROW_H > SAFE_BOTTOM) {
          doc.addPage();
          doc.y = MARGIN;
          drawTableHeader(doc);
        }
        drawTableRow(doc, t, idx);
      });
    }

    const total = doc.bufferedPageRange().count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor(C.secondary)
        .text(`Page ${i + 1} of ${total}`, MARGIN, PAGE_H - FOOTER_H, { align: "center", width: CONTENT_W });
    }

    doc.end();
  });

export async function GET(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const user = await requireAuth();
      if (!user) return errorResponse("Unauthorized", 401);

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

      const transactions: Transaction[] = userData.transactions.map((t) => ({ ...t, amount: Number(t.amount) }));

      const pdf = await buildPDF(userData, transactions);
      const filename = `report-${new Date().toISOString().split("T")[0]}.pdf`;

      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("[PDF Export]", error);

      if (error instanceof Error) {
        if (error.message === "Unauthorized") return errorResponse("Unauthorized", 401);
        if (error.message.startsWith("Font")) return errorResponse(error.message, 500);
      }

      return errorResponse("Failed to generate PDF report.", 500);
    }
  });
}

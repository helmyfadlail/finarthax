import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { formattedCurrency } from "@/utils/formatted-currency";

const MARGIN = 50;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C = {
  primary: "#1f4356",
  secondary: "#336580",
  accent: "#0284c7",
  success: "#077a3e",
  danger: "#c02418",
  light: "#eff6fa",
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

export class PdfPaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfPaginationError";
  }
}

let fontBuffer: Buffer | null = null;

const loadFont = (): Buffer => {
  if (fontBuffer) return fontBuffer;

  const filename = "SpaceGrotesk-Regular.ttf";
  const candidate = path.join(process.cwd(), "public", "fonts", filename);
  if (!fs.existsSync(candidate)) throw new Error(`Font not found: ${candidate}. Commit public/fonts/${filename}.`);

  fontBuffer = fs.readFileSync(candidate);
  return fontBuffer;
};

export interface ReportTransaction {
  id: string;
  date: Date;
  type: string;
  amount: number;
  category?: { name: string } | null;
  account: { name: string };
}

export interface ReportUser {
  name: string;
  email: string;
}

export interface ReportResult {
  buffer: Buffer;
  pages: number;
}

const sum = (txs: ReportTransaction[], type: string) => txs.filter((t) => t.type === type).reduce((acc, t) => acc + t.amount, 0);

const topCategories = (txs: ReportTransaction[], limit = 5): [string, number][] => {
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
    .text(title, MARGIN + 14, y + 8, { width: CONTENT_W - 20, lineBreak: false });
  doc.y = y + 36;
};

const drawTableHeader = (doc: PDFKit.PDFDocument) => {
  const y = doc.y;
  doc.save().fillColor(C.primary).rect(MARGIN, y, CONTENT_W, 20).fill().fillColor(C.white).fontSize(9);
  COLS.forEach((col) => doc.text(col.label, col.x, y + 6, { width: col.w, lineBreak: false }));
  doc.restore();
  doc.y = y + HEADER_H;
};

const cell = (doc: PDFKit.PDFDocument, value: string, colIndex: number, y: number) => {
  const col = COLS[colIndex];
  doc.text(value, col.x, y + 4, { width: col.w, height: ROW_H - 4, lineBreak: false, ellipsis: true });
};

const drawTableRow = (doc: PDFKit.PDFDocument, t: ReportTransaction, idx: number) => {
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
  cell(doc, date, 0, y);
  cell(doc, t.type, 1, y);
  cell(doc, t.category?.name ?? "—", 2, y);
  cell(doc, t.account.name, 3, y);
  doc.fillColor(t.type === "INCOME" ? C.success : C.danger);
  cell(doc, formattedCurrency(t.amount), 4, y);

  doc.y = y + ROW_H;
};

export const buildFinancialReport = (user: ReportUser, transactions: ReportTransaction[]): Promise<ReportResult> =>
  new Promise((resolve, reject) => {
    let doc: PDFKit.PDFDocument;

    try {
      doc = new PDFDocument({ margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 0 }, size: "A4", bufferPages: true });
      doc.registerFont(FONT, loadFont()).font(FONT);
    } catch (error) {
      reject(error);
      return;
    }

    const chunks: Buffer[] = [];
    let plannedPages = 1;

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);

    try {
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
      doc.text(`User: ${user.name}`, MARGIN);
      doc.text(`Email: ${user.email}`, MARGIN);
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
            .text(`${i + 1}. ${name}`, LX, iy, { width: 300, lineBreak: false, ellipsis: true });
          doc.fillColor(C.primary).text(formattedCurrency(total), LX, iy, { align: "right", width: 450 });
          doc.y = iy + 24;
        });
      }

      doc.addPage();
      plannedPages += 1;
      doc.fillColor(C.primary).fontSize(16).text("Transaction History", MARGIN, MARGIN);
      doc.moveDown(1);

      if (transactions.length === 0) {
        doc.fontSize(11).fillColor(C.secondary).text("No transactions found.", { align: "center" });
      } else {
        drawTableHeader(doc);

        transactions.forEach((t, idx) => {
          if (doc.y + ROW_H > SAFE_BOTTOM) {
            doc.addPage();
            plannedPages += 1;
            doc.y = MARGIN;
            drawTableHeader(doc);
          }
          drawTableRow(doc, t, idx);
        });
      }

      const total = doc.bufferedPageRange().count;

      if (total !== plannedPages) throw new PdfPaginationError(`PDF has ${total} pages but ${plannedPages} were planned`);

      for (let i = 0; i < total; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor(C.secondary)
          .text(`Page ${i + 1} of ${total}`, MARGIN, PAGE_H - FOOTER_H, { align: "center", width: CONTENT_W, lineBreak: false });
      }

      if (doc.bufferedPageRange().count !== total) throw new PdfPaginationError("Writing page footers added extra pages");

      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);

        if (buffer.byteLength === 0 || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
          reject(new PdfPaginationError("Renderer produced an invalid PDF"));
          return;
        }

        resolve({ buffer, pages: total });
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

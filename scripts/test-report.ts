import { existsSync, readFileSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const DIR = "tests/reports";

interface TestRow {
  suite: string;
  name: string;
  status: "passed" | "failed" | "skipped" | "todo";
  durationMs: number;
  error: string;
}
interface Run {
  file: string;
  finishedAt: string;
  tests: TestRow[];
}
interface Metric {
  label: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  rps: number;
}
interface Call {
  method: string;
  path: string;
  request: string;
  status: number;
  response: string;
  ms: number;
}
interface Perf {
  users: number;
  requests: number;
  readP95: number;
  writeP95: number;
  dataset: number;
  metrics: Metric[];
}

const read = <T>(name: string): T | null => (existsSync(`${DIR}/${name}`) ? (JSON.parse(readFileSync(`${DIR}/${name}`, "utf8")) as T) : null);

const runs = [read<Run>("app.json"), read<Run>("performance.json")].filter((run): run is Run => run !== null);
const perf = read<Perf>("performance-metrics.json");
const httpByFile: Record<string, Record<string, Call[]>> = { app: read("http-app.json") ?? {}, performance: read("http-performance.json") ?? {} };
const callsOf = (run: Run, test: TestRow): Call[] => httpByFile[run.file]?.[`${test.suite} > ${test.name}`] ?? [];

if (runs.length === 0 && !perf) {
  console.error("No results in tests/reports. Run `npm test` and/or `npm run test:perf` first.");
  process.exit(1);
}

const count = (rows: TestRow[], status: TestRow["status"]) => rows.filter((row) => row.status === status).length;
const seconds = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`);
const COLORS = { passed: "#15803d", failed: "#b91c1c", skipped: "#a16207", todo: "#a16207", ink: "#111827", muted: "#6b7280", line: "#e5e7eb", band: "#f3f4f6" };

const buildExcel = async () => {
  const book = new ExcelJS.Workbook();
  const header = (sheet: ExcelJS.Worksheet) => {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  };
  const paint = (cell: ExcelJS.Cell, status: string) => {
    cell.font = { bold: true, color: { argb: status === "passed" ? "FF15803D" : status === "failed" ? "FFB91C1C" : "FFA16207" } };
  };

  const summary = book.addWorksheet("Summary");
  summary.columns = [
    { header: "Suite file", key: "file", width: 18 },
    { header: "Total", key: "total", width: 9 },
    { header: "Passed", key: "passed", width: 9 },
    { header: "Failed", key: "failed", width: 9 },
    { header: "Skipped", key: "skipped", width: 9 },
    { header: "Duration (s)", key: "duration", width: 14 },
    { header: "Finished at", key: "finished", width: 26 },
  ];
  for (const run of runs) {
    summary.addRow({
      file: run.file,
      total: run.tests.length,
      passed: count(run.tests, "passed"),
      failed: count(run.tests, "failed"),
      skipped: count(run.tests, "skipped") + count(run.tests, "todo"),
      duration: Number((run.tests.reduce((sum, row) => sum + row.durationMs, 0) / 1000).toFixed(2)),
      finished: run.finishedAt,
    });
  }
  header(summary);

  const results = book.addWorksheet("Test results");
  results.columns = [
    { header: "Suite", key: "suite", width: 42 },
    { header: "Test", key: "name", width: 70 },
    { header: "Result", key: "status", width: 11 },
    { header: "Duration (ms)", key: "durationMs", width: 15 },
    { header: "Failure", key: "error", width: 80 },
  ];
  for (const run of runs) for (const row of run.tests) paint(results.addRow({ ...row, suite: `${run.file}: ${row.suite}` }).getCell("status"), row.status);
  results.eachRow((row) => (row.alignment = { vertical: "top", wrapText: true }));
  header(results);

  const http = book.addWorksheet("Requests and responses");
  http.columns = [
    { header: "Suite", key: "suite", width: 34 },
    { header: "Test", key: "test", width: 50 },
    { header: "Method", key: "method", width: 9 },
    { header: "Path", key: "path", width: 40 },
    { header: "Request body", key: "request", width: 50 },
    { header: "Status", key: "status", width: 8 },
    { header: "Response body", key: "response", width: 70 },
    { header: "Time (ms)", key: "ms", width: 10 },
  ];
  for (const run of runs) for (const test of run.tests) for (const call of callsOf(run, test)) http.addRow({ suite: `${run.file}: ${test.suite}`, test: test.name, ...call });
  http.eachRow((row) => (row.alignment = { vertical: "top", wrapText: true }));
  header(http);

  if (perf) {
    const sheet = book.addWorksheet("Performance");
    sheet.columns = [
      { header: "Scenario", key: "label", width: 40 },
      { header: "Requests", key: "count", width: 11 },
      { header: "Req/s", key: "rps", width: 10 },
      { header: "p50 (ms)", key: "p50", width: 11 },
      { header: "p95 (ms)", key: "p95", width: 11 },
      { header: "p99 (ms)", key: "p99", width: 11 },
      { header: "Errors", key: "errors", width: 10 },
    ];
    for (const m of perf.metrics) sheet.addRow({ ...m, rps: Math.round(m.rps), p50: Math.round(m.p50), p95: Math.round(m.p95), p99: Math.round(m.p99) });
    header(sheet);
    sheet.addRow([]);
    sheet.addRow([`Load: ${perf.users} users x ${perf.requests} requests, ${perf.dataset} transactions. Budgets: reads p95 < ${perf.readP95} ms, writes p95 < ${perf.writeP95} ms.`]);
  }

  await book.xlsx.writeFile(`${DIR}/test-report.xlsx`);
};

const buildPdf = () =>
  new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => {
      writeFileSync(`${DIR}/test-report.pdf`, Buffer.concat(chunks));
      resolve();
    });

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const room = (needed: number) => {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    const heading = (text: string) => {
      room(60);
      doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).fillColor(COLORS.ink).text(text, left);
      doc
        .moveTo(left, doc.y + 2)
        .lineTo(left + width, doc.y + 2)
        .strokeColor(COLORS.line)
        .stroke();
      doc.moveDown(0.5);
    };

    const row = (cells: Array<[string, number, string?]>, options: { bold?: boolean; band?: boolean } = {}) => {
      doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      const height = Math.max(...cells.map(([text, w]) => doc.heightOfString(text, { width: w - 8 }))) + 8;
      room(height);
      const top = doc.y;
      if (options.band) doc.rect(left, top, width, height).fill(COLORS.band);
      let x = left;
      for (const [text, w, color] of cells) {
        doc.fillColor(color ?? COLORS.ink).text(text, x + 4, top + 4, { width: w - 8 });
        x += w;
      }
      doc.y = top + height;
    };

    const exchange = (call: Call) => {
      const ok = call.status < 400;
      const block = (text: string, color: string) => {
        if (!text) return;
        doc.font("Courier").fontSize(7);
        const h = doc.heightOfString(text, { width: width - 40 });
        room(Math.min(h, 120) + 4);
        doc.fillColor(color).text(text, left + 24, doc.y, { width: width - 40 });
      };
      room(24);
      doc
        .font("Courier-Bold")
        .fontSize(7.5)
        .fillColor(COLORS.ink)
        .text(`${call.method} ${call.path}`, left + 16, doc.y, { width: width - 32 });
      block(call.request, COLORS.muted);
      doc
        .font("Courier-Bold")
        .fontSize(7.5)
        .fillColor(ok ? COLORS.passed : COLORS.failed)
        .text(`-> ${call.status}  (${call.ms} ms)`, left + 16, doc.y, { width: width - 32 });
      block(call.response, COLORS.muted);
      doc.moveDown(0.3);
    };

    const all = runs.flatMap((run) => run.tests);
    const failed = count(all, "failed");

    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.ink).text("Finarthax test report", left);
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(`Generated ${new Date().toLocaleString()}`, left);

    if (all.length > 0) {
      heading("Result");
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(failed ? COLORS.failed : COLORS.passed)
        .text(failed ? `${failed} test(s) failing` : "All tests passing", left);
      doc.moveDown(0.5);
      row(
        [
          ["Suite", 150],
          ["Total", 60],
          ["Passed", 60],
          ["Failed", 60],
          ["Skipped", 60],
          ["Duration", 85],
        ],
        { bold: true, band: true },
      );
      for (const run of runs) {
        const failing = count(run.tests, "failed");
        row([
          [run.file, 150],
          [String(run.tests.length), 60],
          [String(count(run.tests, "passed")), 60, COLORS.passed],
          [String(failing), 60, failing ? COLORS.failed : COLORS.ink],
          [String(count(run.tests, "skipped") + count(run.tests, "todo")), 60],
          [seconds(run.tests.reduce((sum, r) => sum + r.durationMs, 0)), 85],
        ]);
      }
    }

    if (failed > 0) {
      heading("Failures");
      for (const run of runs) {
        for (const test of run.tests.filter((t) => t.status === "failed")) {
          row([[`${run.file}: ${test.suite} > ${test.name}`, width]], { bold: true });
          row([[test.error || "(no message)", width, COLORS.failed]]);
        }
      }
    }

    if (perf) {
      heading("Performance");
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          `${perf.users} concurrent users x ${perf.requests} requests, ${perf.dataset} transactions. Budgets: reads p95 < ${perf.readP95} ms, writes p95 < ${perf.writeP95} ms. p50 is the typical request; p95 and p99 are the slow tail.`,
          left,
          doc.y,
          { width },
        );
      doc.moveDown(0.5);
      row(
        [
          ["Scenario", 190],
          ["Requests", 55],
          ["Req/s", 45],
          ["p50", 55],
          ["p95", 55],
          ["p99", 55],
          ["Errors", 60],
        ],
        { bold: true, band: true },
      );
      for (const m of perf.metrics) {
        row([
          [m.label, 190],
          [String(m.count), 55],
          [String(Math.round(m.rps)), 45],
          [`${Math.round(m.p50)} ms`, 55],
          [`${Math.round(m.p95)} ms`, 55],
          [`${Math.round(m.p99)} ms`, 55],
          [String(m.errors), 60, m.errors ? COLORS.failed : COLORS.passed],
        ]);
      }
    }

    for (const run of runs) {
      heading(`All tests: ${run.file}`);
      let suite = "";
      for (const test of run.tests) {
        if (test.suite !== suite) {
          suite = test.suite;
          row([[suite, width]], { bold: true, band: true });
        }
        row([
          [test.name, width - 130],
          [test.status, 60, COLORS[test.status]],
          [seconds(test.durationMs), 70, COLORS.muted],
        ]);
        for (const call of callsOf(run, test)) exchange(call);
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - 28, { width, align: "center", lineBreak: false });
    }
    doc.end();
  });

Promise.all([buildExcel(), buildPdf()]).then(() => console.log(`Wrote ${DIR}/test-report.pdf and ${DIR}/test-report.xlsx`));

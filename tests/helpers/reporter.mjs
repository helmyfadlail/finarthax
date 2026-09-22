import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

export default async function* reporter(source) {
  const stack = [];
  const rows = [];
  let file = "tests";

  for await (const { type, data } of source) {
    if (data?.file) file = basename(data.file).replace(/\.test\.[tj]s$/, "");

    if (type === "test:start") stack[data.nesting] = data.name;
    if (type !== "test:pass" && type !== "test:fail") continue;
    if (data.details?.type === "suite") continue;

    const error = type === "test:fail" ? (data.details?.error?.cause?.message ?? data.details?.error?.message ?? "") : "";
    rows.push({
      suite: stack.slice(0, data.nesting).join(" > ") || "(root)",
      name: data.name,
      status: data.skip ? "skipped" : data.todo ? "todo" : type === "test:pass" ? "passed" : "failed",
      durationMs: Math.round((data.details?.duration_ms ?? 0) * 100) / 100,
      error: String(error).split("\n").slice(0, 6).join("\n"),
    });
  }

  mkdirSync("tests/reports", { recursive: true });
  writeFileSync(`tests/reports/${file}.json`, JSON.stringify({ file, finishedAt: new Date().toISOString(), tests: rows }, null, 2));

  try {
    execFileSync(process.execPath, ["--import", "tsx", "scripts/test-report.ts"], { stdio: ["ignore", "ignore", "pipe"] });
    process.stderr.write("\nTest report updated: tests/reports/test-report.pdf and test-report.xlsx\n");
  } catch (error) {
    const why = String(error.stderr ?? error.message)
      .split("\n")
      .slice(0, 3)
      .join(" ");
    process.stderr.write(`\nCould not update the test report (close test-report.pdf/.xlsx if they are open): ${why}\n`);
  }
}

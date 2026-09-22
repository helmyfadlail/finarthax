import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import {
  addTransaction,
  addTransactions,
  balanceOf,
  BASE_URL,
  countPdfPages,
  createTestUser,
  daysAgo,
  percentile,
  register,
  Session,
  TEST_PASSWORD,
  uniqueEmail,
  type Reply,
  type TestUser,
  recordHttp,
} from "./helpers/http";

recordHttp(__filename);

const USERS = 20;
const REQUESTS = 10;
const READ_P95 = 1500;
const WRITE_P95 = 2500;
const DATASET = 1000;
const EXPORT_MS = 15_000;

interface Stats {
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  rps: number;
}

const metrics: Array<Stats & { label: string }> = [];
process.on("exit", () => {
  mkdirSync("tests/reports", { recursive: true });
  writeFileSync("tests/reports/performance-metrics.json", JSON.stringify({ users: USERS, requests: REQUESTS, readP95: READ_P95, writeP95: WRITE_P95, dataset: DATASET, metrics }, null, 2));
});

const report = (label: string, s: Stats) => {
  metrics.push({ label, ...s });
  console.log(
    `  ${label.padEnd(34)} ${String(s.count).padStart(5)} req  ${s.rps.toFixed(0).padStart(4)} req/s  p50 ${s.p50.toFixed(0).padStart(5)}ms  p95 ${s.p95.toFixed(0).padStart(5)}ms  p99 ${s.p99.toFixed(0).padStart(5)}ms  errors ${s.errors}`,
  );
};

const load = async (label: string, call: (user: number, iteration: number) => Promise<Reply>, options: { users?: number; requests?: number; accept?: number[] } = {}): Promise<Stats> => {
  const users = options.users ?? USERS;
  const requests = options.requests ?? REQUESTS;
  const accept = options.accept ?? [200];
  const times: number[] = [];
  let errors = 0;
  const started = performance.now();

  await Promise.all(
    Array.from({ length: users }, async (_, u) => {
      for (let i = 0; i < requests; i++) {
        const reply = await call(u, i);
        times.push(reply.ms);
        if (!accept.includes(reply.status)) errors += 1;
      }
    }),
  );

  const stats = { count: times.length, errors, p50: percentile(times, 50), p95: percentile(times, 95), p99: percentile(times, 99), rps: times.length / ((performance.now() - started) / 1000) };
  report(label, stats);
  return stats;
};

const within = (stats: Stats, budget: number) => {
  assert.equal(stats.errors, 0, `${stats.errors} of ${stats.count} requests failed`);
  assert.ok(stats.p95 < budget, `p95 ${stats.p95.toFixed(0)}ms exceeds the ${budget}ms budget`);
};

describe(`Public endpoints (${USERS} users x ${REQUESTS} requests)`, () => {
  for (const path of ["/api/health", "/api/settings", "/login", "/register"]) {
    it(`GET ${path}`, async () => within(await load(`GET ${path}`, () => new Session().get(path)), READ_P95));
  }

  it("Google sign-in redirect is cheap", async () => {
    within(await load("GET /api/auth/providers", () => new Session().get("/api/auth/providers")), READ_P95);
  });
});

describe(`Authenticated reads on a user with ${DATASET} transactions`, () => {
  let user: TestUser;

  before(async () => {
    user = await createTestUser("perf-data");
    await addTransactions(user, DATASET, 20);
    const now = new Date();
    await user.session.post("/api/budgets", { categoryId: user.expenseCategoryId, amount: 10_000_000, month: now.getMonth() + 1, year: now.getFullYear() });
    for (let i = 0; i < 5; i++) await user.session.post("/api/goals", { name: `Goal ${i}`, targetAmount: 1_000_000 });
    for (let i = 0; i < 5; i++) await user.session.post("/api/tags", { name: `tag-${i}-${Date.now()}` });
    console.log(`  (seeded ${DATASET} transactions)`);
  });

  const lastPage = () => Math.ceil(DATASET / 20);
  const cheap: [string, () => string][] = [
    ["/api/accounts", () => "/api/accounts"],
    ["/api/categories", () => "/api/categories"],
    ["/api/tags", () => "/api/tags"],
    ["/api/goals", () => "/api/goals"],
    ["/api/budgets", () => "/api/budgets"],
    ["/api/notifications", () => "/api/notifications"],
    ["/api/audit-log", () => "/api/audit-log"],
    ["/api/users/settings", () => "/api/users/settings"],
    ["/api/users/profile", () => "/api/users/profile"],
    ["/api/transactions (page 1)", () => "/api/transactions?limit=20&page=1"],
    [`/api/transactions (page ${lastPage()})`, () => `/api/transactions?limit=20&page=${lastPage()}`],
    ["/api/transactions (search)", () => "/api/transactions?search=bulk%209&limit=20"],
    ["/api/transactions (type filter)", () => "/api/transactions?type=EXPENSE&limit=100"],
  ];
  for (const [label, path] of cheap) {
    it(`GET ${label}`, async () => within(await load(`GET ${label}`, () => user.session.get(path())), READ_P95));
  }

  const heavy: [string, () => Promise<Reply>][] = [
    ["/api/dashboard/summary", () => user.session.get("/api/dashboard/summary")],
    ["/api/dashboard/charts", () => user.session.get("/api/dashboard/charts")],
    ["/api/reports/monthly", () => user.session.get("/api/reports/monthly")],
    ["/api/reports/yearly", () => user.session.get("/api/reports/yearly")],
    ["/api/recurring (detection)", () => user.session.get("/api/recurring")],
    ["POST /api/reports/custom", () => user.session.post("/api/reports/custom", { startDate: "2020-01-01", endDate: "2030-01-01" })],
  ];
  for (const [label, call] of heavy) {
    it(`${label}`, async () => within(await load(label, call, { users: Math.min(USERS, 10) }), WRITE_P95));
  }

  it("dashboard pages render quickly", async () => {
    within(await load("GET /en/admin/dashboard/transactions", () => user.session.get("/en/admin/dashboard/transactions")), WRITE_P95);
  });
});

describe("Writes", () => {
  it("creates transactions from many users at once", async () => {
    const users = await Promise.all(Array.from({ length: USERS }, (_, i) => createTestUser(`perf-write-${i}`)));
    const stats = await load("POST /api/transactions", (u) => addTransaction(users[u], { amount: 1_000 }), { requests: 5 });
    within(stats, WRITE_P95);
  });

  it("keeps the balance exact when one account is hit concurrently", async () => {
    const user = await createTestUser("perf-race");
    const workers = 25;
    const each = 4;
    const amount = 1_000;

    const replies = await Promise.all(Array.from({ length: workers * each }, () => addTransaction(user, { amount })));
    assert.ok(
      replies.every((r) => r.status === 200),
      "every concurrent write succeeds",
    );
    assert.equal(await balanceOf(user), -(workers * each * amount), "no lost updates on the account balance");

    const total = (await user.session.get("/api/transactions?limit=1")).json.data.pagination.total;
    assert.equal(total, workers * each);
  });

  it("keeps a budget's spent total exact under concurrent expenses", async () => {
    const user = await createTestUser("perf-budget");
    const { month, year } = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    await user.session.post("/api/budgets", { categoryId: user.expenseCategoryId, amount: 10_000_000, month, year });

    await Promise.all(Array.from({ length: 40 }, () => addTransaction(user, { amount: 2_500 })));
    const budget = (await user.session.get("/api/budgets")).json.data.data[0];
    assert.equal(Number(budget.spent), 40 * 2_500, "no lost updates on the budget");
  });

  it("registers and signs in many new users at once", async () => {
    const stats = await load("POST /api/auth/register", (u, i) => register(uniqueEmail(`perf-reg-${u}-${i}`)), { users: 10, requests: 2 });
    within(stats, 5_000);

    const email = uniqueEmail("perf-login");
    await register(email);
    const times: number[] = [];
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        const s = new Session();
        const started = performance.now();
        await s.login(email, TEST_PASSWORD);
        times.push(performance.now() - started);
      }),
    );
    console.log(`  sign-in x8 concurrent               p95 ${percentile(times, 95).toFixed(0)}ms`);
    assert.ok(percentile(times, 95) < 5_000);
  });
});

describe(`Exports and imports with ${DATASET} transactions`, () => {
  let user: TestUser;
  before(async () => {
    user = await createTestUser("perf-export");
    await addTransactions(user, DATASET, 20);
  });

  it("exports a CSV within budget", async () => {
    const reply = await user.session.get("/api/transactions/export");
    console.log(`  CSV export: ${reply.ms.toFixed(0)}ms, ${(reply.buffer.byteLength / 1024).toFixed(0)} KiB`);
    assert.equal(reply.status, 200);
    assert.equal(reply.text.trim().split("\r\n").length, DATASET + 1);
    assert.ok(reply.ms < EXPORT_MS, `${reply.ms.toFixed(0)}ms exceeds ${EXPORT_MS}ms`);
  });

  it("exports a complete, correctly paginated PDF within budget", async () => {
    const reply = await user.session.get("/api/users/export");
    const pages = countPdfPages(reply.buffer);
    console.log(`  PDF export: ${reply.ms.toFixed(0)}ms, ${(reply.buffer.byteLength / 1024).toFixed(0)} KiB, ${pages} pages`);
    assert.equal(reply.status, 200);
    assert.ok(reply.ms < EXPORT_MS, `${reply.ms.toFixed(0)}ms exceeds ${EXPORT_MS}ms`);
    assert.equal(pages, Number(reply.headers.get("x-report-pages")));
    assert.ok(pages <= 2 + Math.ceil(DATASET / 39), `${pages} pages for ${DATASET} rows suggests blank pages`);
  });

  it("serves several PDF exports at once without corruption", async () => {
    const replies = await Promise.all(Array.from({ length: 5 }, () => user.session.get("/api/users/export")));
    for (const r of replies) {
      assert.equal(r.status, 200);
      assert.equal(r.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
      assert.equal(countPdfPages(r.buffer), Number(r.headers.get("x-report-pages")));
    }
    console.log(`  5 concurrent PDF exports: slowest ${Math.max(...replies.map((r) => r.ms)).toFixed(0)}ms`);
    assert.ok(Math.max(...replies.map((r) => r.ms)) < EXPORT_MS * 2);
  });

  it("imports a large CSV within budget", async () => {
    const importer = await createTestUser("perf-import");
    const rows = Math.min(DATASET, 500);
    const csv = [
      "Date,Type,Amount,Description,Category,Account,To Account,Tags",
      ...Array.from({ length: rows }, (_, i) => `2026-01-${String((i % 27) + 1).padStart(2, "0")},EXPENSE,${1000 + i},Row ${i},Food & Drinks,Cash,,bulk`),
    ].join("\n");
    const form = new FormData();
    form.set("file", new Blob([csv], { type: "text/csv" }), "big.csv");

    const reply = await importer.session.request("POST", "/api/transactions/import", { multipart: form });
    console.log(`  CSV import of ${rows} rows: ${reply.ms.toFixed(0)}ms`);
    assert.equal(reply.status, 200, reply.text.slice(0, 200));
    assert.equal(reply.json.data.created, rows);
    assert.ok(reply.ms < EXPORT_MS, `${reply.ms.toFixed(0)}ms exceeds ${EXPORT_MS}ms`);
  });
});

describe("Mixed realistic workload", () => {
  it("handles users browsing, adding and removing at the same time", async () => {
    const users = await Promise.all(Array.from({ length: USERS }, (_, i) => createTestUser(`perf-mixed-${i}`)));
    let failures = 0;
    const times: number[] = [];
    const timed = async (reply: Promise<Reply>, ok: number[] = [200]) => {
      const r = await reply;
      times.push(r.ms);
      if (!ok.includes(r.status)) failures += 1;
      return r;
    };

    const started = performance.now();
    await Promise.all(
      users.map(async (u) => {
        for (let i = 0; i < 4; i++) {
          await timed(u.session.get("/api/dashboard/summary"));
          await timed(u.session.get("/api/transactions?limit=20"));
          const created = await timed(addTransaction(u, { amount: 5_000 + i }));
          await timed(u.session.get("/api/accounts"));
          await timed(u.session.get("/api/reports/monthly"));
          if (created.status === 200) await timed(u.session.delete(`/api/transactions/${created.json.data.id}`));
        }
      }),
    );

    const stats: Stats = {
      count: times.length,
      errors: failures,
      p50: percentile(times, 50),
      p95: percentile(times, 95),
      p99: percentile(times, 99),
      rps: times.length / ((performance.now() - started) / 1000),
    };
    report("mixed workload", stats);
    within(stats, WRITE_P95);

    for (const u of users) assert.equal(await balanceOf(u), 0, "every add was matched by a delete, so the balance is back to zero");
  });

  it("does not slow down over a sustained run", async () => {
    const user = await createTestUser("perf-soak");
    await addTransactions(user, 100, 20);
    const rounds = 6;
    const p95s: number[] = [];

    for (let r = 0; r < rounds; r++) {
      const s = await load(`soak round ${r + 1}`, () => user.session.get("/api/transactions?limit=20"), { users: 10, requests: 10 });
      assert.equal(s.errors, 0);
      p95s.push(s.p95);
    }

    const first = Math.max(percentile(p95s.slice(0, 2), 50), 20);
    const last = percentile(p95s.slice(-2), 50);
    assert.ok(last < first * 3 + 200, `latency degraded from ${first.toFixed(0)}ms to ${last.toFixed(0)}ms across the run`);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Runs `run` once per virtual user, all users at the same time, timing every call made through `timed`.
const flow = async (label: string, users: TestUser[], run: (user: TestUser, timed: (reply: Promise<Reply>, ok?: number[]) => Promise<Reply>, index: number) => Promise<void>): Promise<Stats> => {
  const times: number[] = [];
  let errors = 0;
  const started = performance.now();

  await Promise.all(
    users.map((user, index) =>
      run(
        user,
        async (pending, ok = [200]) => {
          const reply = await pending;
          times.push(reply.ms);
          if (!ok.includes(reply.status)) errors += 1;
          return reply;
        },
        index,
      ),
    ),
  );

  const stats = { count: times.length, errors, p50: percentile(times, 50), p95: percentile(times, 95), p99: percentile(times, 99), rps: times.length / ((performance.now() - started) / 1000) };
  report(label, stats);
  return stats;
};

const PAGE_USERS = Math.min(USERS, 10);

describe("Public pages, quick entry and password flows", () => {
  let owner: TestUser;
  before(async () => void (owner = await createTestUser("perf-quick")));

  // These endpoints are rate limited by design, so 429 is a correct answer under load, not a failure.
  for (const path of ["/", "/forgot-password", "/reset-password", "/reset-password/success"]) {
    it(`GET ${path}`, async () => within(await load(`GET ${path}`, () => new Session().get(path), { accept: [200, 307, 308] }), READ_P95));
  }

  it("quick entry lookup by email", async () => {
    within(await load("GET /api/quick-transactions", () => new Session().get(`/api/quick-transactions?email=${encodeURIComponent(owner.email)}`), { accept: [200, 429] }), READ_P95);
  });

  it("quick entry records a transaction", async () => {
    const body = { email: owner.email, type: "EXPENSE", accountId: owner.accountId, categoryId: owner.expenseCategoryId, amount: 1_000, description: "perf quick", date: new Date().toISOString() };
    within(await load("POST /api/quick-transactions", () => new Session().post("/api/quick-transactions", body), { users: 5, requests: 3, accept: [200, 429] }), WRITE_P95);
  });

  it("quick recurring action rejects unknown series quickly", async () => {
    const body = { email: owner.email, action: "log", transactionId: "does-not-exist" };
    within(await load("POST /api/quick-transactions/recurring", () => new Session().post("/api/quick-transactions/recurring", body), { users: 5, requests: 3, accept: [403, 404, 422, 429] }), READ_P95);
  });

  it("forgot and reset password reject bad input quickly", async () => {
    within(await load("POST /api/auth/forgot-password", () => new Session().post("/api/auth/forgot-password", { email: uniqueEmail("nobody") }), { users: 5, requests: 3, accept: [404, 429] }), READ_P95);
    within(await load("POST /api/auth/reset-password", () => new Session().post("/api/auth/reset-password", { token: "invalid-token", password: TEST_PASSWORD }), { users: 5, requests: 3, accept: [400, 422, 429] }), READ_P95);
  });

  it("signs many existing users in at once (password hashing)", async () => {
    const users = await Promise.all(Array.from({ length: PAGE_USERS }, (_, i) => createTestUser(`perf-login-${i}`)));
    const stats = await flow("POST /api/auth/callback/credentials", users, async (user, timed) => {
      for (let i = 0; i < 2; i++) {
        const session = new Session();
        const csrf = await session.get("/api/auth/csrf");
        await timed(session.request("POST", "/api/auth/callback/credentials", { form: { csrfToken: csrf.json.csrfToken, email: user.email, password: TEST_PASSWORD, callbackUrl: BASE_URL, json: "true" } }), [200, 302]);
      }
    });
    within(stats, WRITE_P95);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("Every dashboard page for a signed-in user", () => {
  let user: TestUser;

  before(async () => {
    user = await createTestUser("perf-pages");
    await addTransactions(user, 200, 20);
  });

  // app-settings is superadmin only, so a normal user is redirected; the redirect itself must be fast.
  const pages = ["", "/accounts", "/budgets", "/categories", "/goals", "/reports", "/transactions", "/audit-log", "/profiles", "/settings", "/app-settings"];
  for (const page of pages) {
    const path = `/en/admin/dashboard${page}`;
    it(`GET ${path}`, async () => within(await load(`GET ${path}`, () => user.session.get(path), { users: PAGE_USERS, accept: [200, 307, 308] }), WRITE_P95));
  }
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("Write flows for every resource, many users at once", () => {
  let users: TestUser[];
  before(async () => void (users = await Promise.all(Array.from({ length: PAGE_USERS }, (_, i) => createTestUser(`perf-flow-${i}`)))));

  const when = () => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  };

  it("accounts: create, edit, value check-in, history, delete", async () => {
    within(
      await flow("accounts lifecycle", users, async (u, timed) => {
        const acct = (await timed(u.session.post("/api/accounts", { name: "Perf stocks", type: "INVESTMENT", balance: 1_000_000 }))).json.data;
        await timed(u.session.put(`/api/accounts/${acct.id}`, { name: "Perf stocks renamed", color: "#00AA55" }));
        await timed(u.session.post(`/api/accounts/${acct.id}/value-history`, { newBalance: 1_250_000, note: "perf" }));
        await timed(u.session.get(`/api/accounts/${acct.id}/value-history`));
        await timed(u.session.delete(`/api/accounts/${acct.id}`));
      }),
      WRITE_P95,
    );
  });

  it("categories and tags: create, edit, delete", async () => {
    within(
      await flow("categories and tags lifecycle", users, async (u, timed, i) => {
        const category = (await timed(u.session.post("/api/categories", { name: `Perf ${i}`, type: "EXPENSE", icon: "🐶", color: "#AA5500" }))).json.data;
        await timed(u.session.put(`/api/categories/${category.id}`, { name: `Perf renamed ${i}` }));
        await timed(u.session.delete(`/api/categories/${category.id}`));
        const tag = (await timed(u.session.post("/api/tags", { name: `perf-${i}-${Date.now()}` }))).json.data;
        await timed(u.session.put(`/api/tags/${tag.id}`, { name: `perf-renamed-${i}-${Date.now()}` }));
        await timed(u.session.delete(`/api/tags/${tag.id}`));
      }),
      WRITE_P95,
    );
  });

  it("budgets and goals: create, edit, progress, delete", async () => {
    within(
      await flow("budgets and goals lifecycle", users, async (u, timed) => {
        const budget = (await timed(u.session.post("/api/budgets", { categoryId: u.expenseCategoryId, amount: 1_000_000, ...when() }))).json.data;
        await timed(u.session.put(`/api/budgets/${budget.id}`, { amount: 2_000_000, autoRenew: true }));
        await timed(u.session.delete(`/api/budgets/${budget.id}`));
        const goal = (await timed(u.session.post("/api/goals", { name: "Perf goal", targetAmount: 1_000_000 }))).json.data;
        await timed(u.session.patch(`/api/goals/${goal.id}/progress`, { currentAmount: 400_000 }));
        await timed(u.session.put(`/api/goals/${goal.id}`, { name: "Perf goal renamed" }));
        await timed(u.session.delete(`/api/goals/${goal.id}`));
      }),
      WRITE_P95,
    );
  });

  it("transactions: create, edit, delete and recurring series actions", async () => {
    within(
      await flow("transactions and recurring lifecycle", users, async (u, timed) => {
        const tx = (await timed(addTransaction(u, { amount: 5_000 }))).json.data;
        await timed(u.session.put(`/api/transactions/${tx.id}`, { type: "EXPENSE", amount: 6_000, description: "edited" }));
        await timed(u.session.delete(`/api/transactions/${tx.id}`));

        const series = (await timed(addTransaction(u, { isRecurring: true, recurrenceInterval: "MONTHLY", date: daysAgo(35), description: "Perf rent" }))).json.data;
        await timed(u.session.get("/api/recurring"));
        await timed(u.session.post(`/api/recurring/${series.id}/confirm`, {}));
        await timed(u.session.post(`/api/recurring/${series.id}/skip`, {}));
        await timed(u.session.post(`/api/recurring/${series.id}/dismiss`, {}));
        await timed(u.session.delete(`/api/recurring/${series.id}/dismiss`));
        await timed(u.session.patch(`/api/recurring/${series.id}`, { isRecurring: false }));
      }),
      WRITE_P95,
    );
  });

  it("notifications: list, read one, read all, delete", async () => {
    within(
      await flow("notifications lifecycle", users, async (u, timed) => {
        await addTransaction(u, { amount: 2_000 });
        let first: { id: string } | undefined;
        for (let i = 0; i < 25 && !first; i++) {
          first = (await u.session.get("/api/notifications")).json.data.data[0];
          if (!first) await new Promise((r) => setTimeout(r, 200));
        }
        await timed(u.session.get("/api/notifications?unreadOnly=true"));
        if (first) {
          await timed(u.session.patch(`/api/notifications/${first.id}`, {}));
          await timed(u.session.delete(`/api/notifications/${first.id}`));
        }
        await timed(u.session.patch("/api/notifications/mark-all-read", {}));
      }),
      WRITE_P95,
    );
  });

  it("profile, settings, password and image upload signature", async () => {
    const next = `${TEST_PASSWORD}-new`;
    within(
      await flow("profile, settings and password", users, async (u, timed) => {
        await timed(u.session.put("/api/users/profile", { name: "Perf Person" }));
        await timed(u.session.get("/api/users/settings")); // first read creates the default settings
        await timed(u.session.patch("/api/users/settings/theme", { value: "dark" }));
        // Password hashing is deliberately slow, so this is the call most likely to regress.
        await timed(u.session.post("/api/users/change-password", { currentPassword: TEST_PASSWORD, newPassword: next }));
        // 500 only when ImageKit keys are absent in this environment; the signature itself is cheap.
        await timed(u.session.get("/api/imagekit/upload-auth"), [200, 500]);
      }),
      WRITE_P95,
    );
  });

  it("deletes whole accounts of data at once", async () => {
    const doomed = await Promise.all(Array.from({ length: PAGE_USERS }, (_, i) => createTestUser(`perf-delete-${i}`)));
    for (const u of doomed) await addTransactions(u, 30, 10);
    within(await flow("DELETE /api/users/delete (30 transactions each)", doomed, async (u, timed) => void (await timed(u.session.delete("/api/users/delete")))), WRITE_P95);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Superadmin settings and the scheduled jobs need credentials, so they run only when supplied.
describe("Admin settings and scheduled jobs", () => {
  const adminEmail = process.env.TEST_SUPERADMIN_EMAIL;
  const adminPassword = process.env.TEST_SUPERADMIN_PASSWORD;
  const cron = process.env.TEST_CRON_SECRET;

  it("GET /api/app-settings", { skip: !(adminEmail && adminPassword) && "set TEST_SUPERADMIN_EMAIL and TEST_SUPERADMIN_PASSWORD" }, async () => {
    const admin = new Session();
    await admin.login(adminEmail!, adminPassword!);
    within(await load("GET /api/app-settings", () => admin.get("/api/app-settings"), { users: 5 }), READ_P95);
    within(await load("GET /en/admin/dashboard/app-settings", () => admin.get("/en/admin/dashboard/app-settings"), { users: 5 }), WRITE_P95);
  });

  it("POST /api/budgets/rollover and /api/notifications/digest", { skip: !cron && "set TEST_CRON_SECRET" }, async () => {
    const auth = { authorization: `Bearer ${cron}` };
    // Both jobs walk every user, so they are measured once each rather than under concurrency.
    within(await load("POST /api/budgets/rollover", () => new Session().post("/api/budgets/rollover", {}, auth), { users: 1, requests: 3 }), EXPORT_MS);
    within(await load("POST /api/notifications/digest", () => new Session().post("/api/notifications/digest?kind=weekly", {}, auth), { users: 1, requests: 1, accept: [200, 503] }), EXPORT_MS);
  });
});

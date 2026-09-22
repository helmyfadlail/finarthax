import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { before, describe, it } from "node:test";
import { buildFinancialReport, type ReportTransaction } from "../src/lib/pdf-report";
import { parseManifests, validateManifests } from "../scripts/validate-k8s";
import {
  addTransaction,
  addTransactions,
  balanceOf,
  countPdfPages,
  createTestUser,
  daysAgo,
  register,
  Session,
  TEST_PASSWORD,
  uniqueEmail,
  type Reply,
  type TestUser,
  recordHttp,
} from "./helpers/http";

recordHttp(__filename);

const VALIDATION = [400, 422];
const MISSING_ID = "does-not-exist";

const status = (reply: Reply, expected: number | number[]) => {
  const ok = Array.isArray(expected) ? expected.includes(reply.status) : reply.status === expected;
  assert.ok(ok, `expected HTTP ${expected}, got ${reply.status}: ${reply.text.slice(0, 300)}`);
  return reply;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const list = (reply: Reply) => reply.json.data.data as any[];
const monthNow = () => ({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

describe("Platform and public pages", () => {
  it("reports healthy with the database up", async () => {
    const reply = status(await new Session().get("/api/health"), 200);
    assert.equal(reply.json.status, "healthy");
    assert.equal(reply.json.checks.database.status, "up");
  });

  it("serves the public sign-in, sign-up and password pages", async () => {
    for (const path of ["/login", "/register", "/forgot-password", "/reset-password"]) {
      const reply = status(await new Session().get(path), 200);
      assert.match(reply.headers.get("content-type") ?? "", /text\/html/, path);
    }
  });

  it("exposes only public app settings", async () => {
    const reply = status(await new Session().get("/api/settings"), 200);
    assert.ok(Array.isArray(reply.json.data));
    for (const s of reply.json.data) assert.ok(s.key && "value" in s && s.label, "public settings carry key, value and label");
    assert.ok(!reply.json.data.some((s: { key: string }) => s.key === "allow_registration"), "private settings must not leak");
  });

  it("wraps every API reply in the same success/message envelope", async () => {
    const user = await createTestUser("envelope");
    const ok = (await user.session.get("/api/accounts")).json;
    const bad = (await user.session.get("/api/accounts/x")).json ?? {};
    assert.equal(ok.success, true);
    assert.ok("message" in ok && "data" in ok);
    assert.ok(bad.success === false || bad.success === undefined);
  });
});

describe("Authentication", () => {
  it("offers Google and credentials sign-in", async () => {
    const reply = status(await new Session().get("/api/auth/providers"), 200);
    assert.ok(reply.json.google && reply.json.credentials);
    assert.match(reply.json.google.callbackUrl, /\/api\/auth\/callback\/google$/);
  });

  it("sends Google sign-in to Google with a redirect_uri on the app origin", async () => {
    const anon = new Session();
    const csrf = await anon.get("/api/auth/csrf");
    const reply = await anon.request("POST", "/api/auth/signin/google", { form: { csrfToken: csrf.json.csrfToken, callbackUrl: "/" } });
    const location = reply.headers.get("location") ?? "";
    assert.equal(reply.status, 302);
    assert.ok(location.startsWith("https://accounts.google.com/"), location);
    assert.ok(new URL(location).searchParams.get("redirect_uri")?.endsWith("/api/auth/callback/google"));
  });

  it("registers a user with default categories and a cash account", async () => {
    const user = await createTestUser("register");
    const categories = (await user.session.get("/api/categories")).json.data as { type: string; isDefault: boolean }[];
    assert.equal(categories.filter((c) => c.type === "INCOME").length, 4);
    assert.equal(categories.filter((c) => c.type === "EXPENSE").length, 6);
    assert.ok(categories.every((c) => c.isDefault));

    const accounts = (await user.session.get("/api/accounts")).json.data;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].name, "Cash");
    assert.equal(accounts[0].isDefault, true);
  });

  it("rejects invalid registrations with field errors", async () => {
    for (const body of [
      { email: "not-an-email", password: TEST_PASSWORD, name: "Valid Name" },
      { email: uniqueEmail("weak"), password: "short", name: "Valid Name" },
      { email: uniqueEmail("weak"), password: "alllowercase1", name: "Valid Name" },
      { email: uniqueEmail("weak"), password: "NoNumbersHere", name: "Valid Name" },
      { email: uniqueEmail("short"), password: TEST_PASSWORD, name: "x" },
    ]) {
      const reply = status(await new Session().post("/api/auth/register", body), VALIDATION);
      assert.equal(reply.json.success, false);
    }
  });

  it("refuses a duplicate email", async () => {
    const email = uniqueEmail("dup");
    status(await register(email), 200);
    status(await register(email), 409);
  });

  it("rejects a wrong password and an unknown email, and accepts the right one", async () => {
    const email = uniqueEmail("login");
    await register(email);
    await assert.rejects(new Session().login(email, `${TEST_PASSWORD}-wrong`));
    await assert.rejects(new Session().login(uniqueEmail("ghost")));

    const s = new Session();
    await s.login(email);
    assert.equal((await s.currentUser())?.email, email);
  });

  it("ends the session on sign-out", async () => {
    const user = await createTestUser("signout");
    status(await user.session.get("/api/accounts"), 200);
    await user.session.signOut();
    assert.equal(await user.session.currentUser(), undefined);
    status(await user.session.get("/api/accounts"), 401);
  });

  it("validates password-reset requests", async () => {
    status(await new Session().post("/api/auth/forgot-password", { email: "nope" }), VALIDATION);
    status(await new Session().post("/api/auth/forgot-password", { email: uniqueEmail("unknown") }), 404);
    status(await new Session().post("/api/auth/reset-password", { token: "not-a-real-token", password: TEST_PASSWORD }), 400);
    status(await new Session().post("/api/auth/reset-password", { token: "x", password: "weak" }), VALIDATION);
    status(await new Session().post("/api/auth/reset-password", {}), VALIDATION);
  });
});

describe("Access control", () => {
  const protectedRoutes: [string, string][] = [
    ["GET", "/api/accounts"],
    ["POST", "/api/accounts"],
    ["PUT", "/api/accounts/x"],
    ["DELETE", "/api/accounts/x"],
    ["GET", "/api/accounts/x/value-history"],
    ["GET", "/api/categories"],
    ["POST", "/api/categories"],
    ["GET", "/api/tags"],
    ["POST", "/api/tags"],
    ["GET", "/api/transactions"],
    ["POST", "/api/transactions"],
    ["PUT", "/api/transactions/x"],
    ["DELETE", "/api/transactions/x"],
    ["GET", "/api/transactions/export"],
    ["POST", "/api/transactions/import"],
    ["GET", "/api/budgets"],
    ["POST", "/api/budgets"],
    ["GET", "/api/goals"],
    ["POST", "/api/goals"],
    ["PATCH", "/api/goals/x/progress"],
    ["GET", "/api/recurring"],
    ["POST", "/api/recurring/x/confirm"],
    ["POST", "/api/recurring/x/skip"],
    ["POST", "/api/recurring/x/dismiss"],
    ["PATCH", "/api/recurring/x"],
    ["GET", "/api/dashboard/summary"],
    ["GET", "/api/dashboard/charts"],
    ["GET", "/api/reports/monthly"],
    ["GET", "/api/reports/yearly"],
    ["POST", "/api/reports/custom"],
    ["GET", "/api/notifications"],
    ["PATCH", "/api/notifications/mark-all-read"],
    ["PATCH", "/api/notifications/x"],
    ["GET", "/api/audit-log"],
    ["GET", "/api/users/profile"],
    ["PUT", "/api/users/profile"],
    ["GET", "/api/users/settings"],
    ["PATCH", "/api/users/settings/theme"],
    ["POST", "/api/users/change-password"],
    ["GET", "/api/users/export"],
    ["DELETE", "/api/users/delete"],
    ["GET", "/api/app-settings"],
    ["POST", "/api/app-settings"],
    ["GET", "/api/imagekit/upload-auth"],
    ["DELETE", "/api/imagekit/delete/some-file-id"],
  ];

  for (const [method, path] of protectedRoutes) {
    it(`rejects anonymous ${method} ${path}`, async () => {
      status(await new Session().request(method, path, method === "GET" || method === "DELETE" ? {} : { body: {} }), 401);
    });
  }

  it("keeps the scheduled-job endpoints closed without the shared secret", async () => {
    for (const path of ["/api/budgets/rollover", "/api/notifications/digest"]) {
      status(await new Session().post(path, {}), [401, 503]);
      status(await new Session().post(path, {}, { authorization: "Bearer definitely-wrong" }), [401, 503]);
    }
  });

  it("runs the scheduled jobs when given the secret", { skip: !process.env.TEST_CRON_SECRET && "set TEST_CRON_SECRET" }, async () => {
    const auth = { authorization: `Bearer ${process.env.TEST_CRON_SECRET}` };
    status(await new Session().post("/api/budgets/rollover", {}, auth), 200);
    status(await new Session().post("/api/notifications/digest?kind=bogus", {}, auth), [422, 503]);
  });
});

describe("Accounts", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("acct")));

  it("creates bank, e-wallet, credit card and investment accounts", async () => {
    for (const body of [
      { name: "Main bank", type: "BANK", balance: 1_000_000 },
      { name: "GoPay", type: "EWALLET", balance: 50_000 },
      { name: "Visa", type: "CREDIT_CARD", balance: 0, creditLimit: 5_000_000 },
      { name: "Stocks", type: "INVESTMENT", balance: 2_000_000 },
    ]) {
      const reply = status(await user.session.post("/api/accounts", body), 200);
      assert.equal(reply.json.data.name, body.name);
      assert.equal(reply.json.data.type, body.type);
    }
    assert.equal((await user.session.get("/api/accounts")).json.data.length, 5);
  });

  it("stores a credit limit only on credit cards", async () => {
    const bank = status(await user.session.post("/api/accounts", { name: "Limit ignored", type: "BANK", creditLimit: 999 }), 200);
    assert.ok(bank.json.data.creditLimit === null || bank.json.data.creditLimit === undefined);
    const accounts = (await user.session.get("/api/accounts")).json.data;
    assert.equal(Number(accounts.find((a: { name: string }) => a.name === "Visa").creditLimit), 5_000_000);
  });

  it("rejects invalid accounts", async () => {
    status(await user.session.post("/api/accounts", { name: "", type: "BANK" }), VALIDATION);
    status(await user.session.post("/api/accounts", { name: "x", type: "PIGGY_BANK" }), VALIDATION);
    status(await user.session.post("/api/accounts", { name: "x", type: "BANK", color: "red" }), VALIDATION);
  });

  it("moves the default flag when another account becomes default", async () => {
    const created = status(await user.session.post("/api/accounts", { name: "New default", type: "BANK", isDefault: true }), 200);
    const accounts = (await user.session.get("/api/accounts")).json.data as { id: string; isDefault: boolean }[];
    assert.deepEqual(
      accounts.filter((a) => a.isDefault).map((a) => a.id),
      [created.json.data.id],
    );
  });

  it("updates an account", async () => {
    const id = (await user.session.get("/api/accounts")).json.data.find((a: { name: string }) => a.name === "GoPay").id;
    const reply = status(await user.session.put(`/api/accounts/${id}`, { name: "GoPay renamed", color: "#00AA55" }), 200);
    assert.equal(reply.json.data.name, "GoPay renamed");
    assert.equal(reply.json.data.color, "#00AA55");
  });

  it("returns 404 for an account that does not exist", async () => {
    status(await user.session.put(`/api/accounts/${MISSING_ID}`, { name: "x" }), 404);
    status(await user.session.delete(`/api/accounts/${MISSING_ID}`), 404);
  });

  it("blocks currency changes and deletion once an account has transactions", async () => {
    const acct = status(await user.session.post("/api/accounts", { name: "Used", type: "BANK", balance: 100_000 }), 200).json.data;
    status(await addTransaction({ ...user, accountId: acct.id }, { amount: 10_000 }), 200);

    status(await user.session.put(`/api/accounts/${acct.id}`, { currency: "USD" }), 400);
    status(await user.session.delete(`/api/accounts/${acct.id}`), 400);
  });

  it("deletes an account with no transactions", async () => {
    const acct = status(await user.session.post("/api/accounts", { name: "Disposable", type: "CASH" }), 200).json.data;
    status(await user.session.delete(`/api/accounts/${acct.id}`), 200);
    status(await user.session.delete(`/api/accounts/${acct.id}`), 404);
  });

  it("records investment value check-ins and their history", async () => {
    const stocks = (await user.session.get("/api/accounts")).json.data.find((a: { name: string }) => a.name === "Stocks");
    const reply = status(await user.session.post(`/api/accounts/${stocks.id}/value-history`, { newBalance: 2_500_000, note: "Rally" }), 200);
    assert.equal(Number(reply.json.data.changeAmount), 500_000);
    assert.equal(Number(reply.json.data.changePercent), 25);
    assert.equal(await balanceOf(user, stocks.id), 2_500_000);

    const history = status(await user.session.get(`/api/accounts/${stocks.id}/value-history`), 200).json.data;
    assert.equal(history.length, 1);
    assert.equal(history[0].note, "Rally");
  });

  it("only allows value check-ins on investment accounts", async () => {
    status(await user.session.post(`/api/accounts/${user.accountId}/value-history`, { newBalance: 1 }), 400);
    const stocks = (await user.session.get("/api/accounts")).json.data.find((a: { name: string }) => a.name === "Stocks");
    status(await user.session.post(`/api/accounts/${stocks.id}/value-history`, {}), VALIDATION);
    status(await user.session.get(`/api/accounts/${MISSING_ID}/value-history`), 404);
  });

  it("enforces the per-user account limit", async () => {
    const limited = await createTestUser("acct-limit");
    let last: Reply | undefined;
    for (let i = 0; i < 12; i++) {
      last = await limited.session.post("/api/accounts", { name: `Extra ${i}`, type: "CASH" });
      if (last.status !== 200) break;
    }
    status(last!, 400);
    assert.match(last!.json.message, /maximum/i);
  });
});

describe("Categories", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("cat")));

  it("lists categories and filters them by type", async () => {
    const all = (await user.session.get("/api/categories")).json.data;
    const income = (await user.session.get("/api/categories?type=INCOME")).json.data;
    assert.equal(all.length, 10);
    assert.ok(income.length === 4 && income.every((c: { type: string }) => c.type === "INCOME"));
  });

  it("creates, updates and deletes a custom category", async () => {
    const created = status(await user.session.post("/api/categories", { name: "Pets", type: "EXPENSE", icon: "🐶", color: "#AA5500" }), 200).json.data;
    assert.equal(created.isDefault, false);

    const updated = status(await user.session.put(`/api/categories/${created.id}`, { name: "Pet care" }), 200);
    assert.equal(updated.json.data.name, "Pet care");

    status(await user.session.delete(`/api/categories/${created.id}`), 200);
    status(await user.session.delete(`/api/categories/${created.id}`), 404);
  });

  it("rejects invalid categories", async () => {
    status(await user.session.post("/api/categories", { name: "", type: "EXPENSE" }), VALIDATION);
    status(await user.session.post("/api/categories", { name: "Bad type", type: "TRANSFER" }), VALIDATION);
    status(await user.session.post("/api/categories", { name: "Bad colour", type: "EXPENSE", color: "purple" }), VALIDATION);
  });

  it("protects the built-in default categories", async () => {
    const builtin = (await user.session.get("/api/categories")).json.data[0];
    status(await user.session.put(`/api/categories/${builtin.id}`, { name: "Renamed" }), 403);
    status(await user.session.delete(`/api/categories/${builtin.id}`), 403);
    status(await user.session.put(`/api/categories/${MISSING_ID}`, { name: "x" }), 404);
  });
});

describe("Tags", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("tag")));

  it("creates, lists, renames and deletes tags", async () => {
    const tag = status(await user.session.post("/api/tags", { name: "holiday", color: "#3366FF" }), 200).json.data;
    assert.ok((await user.session.get("/api/tags")).json.data.some((t: { id: string }) => t.id === tag.id));

    assert.equal(status(await user.session.put(`/api/tags/${tag.id}`, { name: "trip" }), 200).json.data.name, "trip");
    status(await user.session.delete(`/api/tags/${tag.id}`), 200);
    status(await user.session.delete(`/api/tags/${tag.id}`), 404);
  });

  it("rejects invalid tags", async () => {
    status(await user.session.post("/api/tags", { name: "" }), VALIDATION);
    status(await user.session.post("/api/tags", { name: "x".repeat(31) }), VALIDATION);
    status(await user.session.post("/api/tags", { name: "ok", color: "blue" }), VALIDATION);
    status(await user.session.put(`/api/tags/${MISSING_ID}`, { name: "x" }), 404);
  });

  it("detaches a deleted tag from its transactions", async () => {
    const tag = (await user.session.post("/api/tags", { name: `temp-${Date.now()}` })).json.data;
    const tx = status(await addTransaction(user, { tagIds: [tag.id] }), 200).json.data;
    assert.equal(tx.tags.length, 1);
    status(await user.session.delete(`/api/tags/${tag.id}`), 200);
    const rows = list(await user.session.get("/api/transactions?limit=100"));
    assert.deepEqual(rows.find((r) => r.id === tx.id).tags, []);
  });
});

describe("Transactions", () => {
  let user: TestUser;
  let savings: string;
  before(async () => {
    user = await createTestUser("tx");
    savings = (await user.session.post("/api/accounts", { name: "Savings", type: "BANK", balance: 0 })).json.data.id;
  });

  it("records income and expenses and keeps the balance in step", async () => {
    status(await addTransaction(user, { type: "INCOME", categoryId: user.incomeCategoryId, amount: 500_000 }), 200);
    assert.equal(await balanceOf(user), 500_000);
    status(await addTransaction(user, { amount: 120_000 }), 200);
    assert.equal(await balanceOf(user), 380_000);
  });

  it("moves money between accounts with a transfer", async () => {
    const before = await balanceOf(user);
    const reply = status(await addTransaction(user, { type: "TRANSFER", toAccountId: savings, categoryId: undefined, amount: 100_000 }), 200);
    assert.equal(reply.json.data.type, "TRANSFER");
    assert.equal(await balanceOf(user), before - 100_000);
    assert.equal(await balanceOf(user, savings), 100_000);
  });

  it("rejects invalid transactions", async () => {
    status(await addTransaction(user, { amount: 0 }), VALIDATION);
    status(await addTransaction(user, { amount: -5 }), VALIDATION);
    status(await addTransaction(user, { categoryId: undefined }), VALIDATION);
    status(await addTransaction(user, { date: undefined }), VALIDATION);
    status(await addTransaction(user, { type: "REFUND" }), VALIDATION);
    status(await addTransaction(user, { type: "TRANSFER", toAccountId: user.accountId, categoryId: undefined }), VALIDATION);
  });

  it("refuses unknown accounts, categories and tags", async () => {
    status(await addTransaction(user, { accountId: MISSING_ID }), 404);
    status(await addTransaction(user, { categoryId: MISSING_ID }), 404);
    status(await addTransaction(user, { tagIds: [MISSING_ID] }), 404);
  });

  it("pages, filters and searches the list", async () => {
    const tag = (await user.session.post("/api/tags", { name: `filter-${Date.now()}` })).json.data;
    await addTransaction(user, { description: "Unique espresso", amount: 33_000, tagIds: [tag.id] });
    await addTransactions(user, 25);

    const page1 = status(await user.session.get("/api/transactions?limit=10&page=1"), 200).json.data;
    assert.equal(page1.data.length, 10);
    assert.ok(page1.pagination.total >= 26);
    assert.equal(page1.pagination.totalPages, Math.ceil(page1.pagination.total / 10));
    const page2 = status(await user.session.get("/api/transactions?limit=10&page=2"), 200).json.data;
    assert.notEqual(page1.data[0].id, page2.data[0].id);

    assert.equal(list(await user.session.get("/api/transactions?search=espresso")).length, 1);
    assert.equal(list(await user.session.get("/api/transactions?search=ESPRESSO")).length, 1, "search ignores case");
    assert.equal(list(await user.session.get(`/api/transactions?tagId=${tag.id}`)).length, 1);
    assert.ok(list(await user.session.get("/api/transactions?type=INCOME&limit=100")).every((t) => t.type === "INCOME"));
    assert.ok(list(await user.session.get(`/api/transactions?categoryId=${user.incomeCategoryId}&limit=100`)).every((t) => t.categoryId === user.incomeCategoryId));
    assert.ok(list(await user.session.get(`/api/transactions?accountId=${savings}&limit=100`)).every((t) => t.accountId === savings || t.toAccountId === savings));

    const future = new Date(Date.now() + 86_400_000 * 30).toISOString();
    assert.equal(list(await user.session.get(`/api/transactions?startDate=${encodeURIComponent(future)}`)).length, 0);
    assert.ok(list(await user.session.get(`/api/transactions?endDate=${encodeURIComponent(future)}`)).length > 0);
  });

  it("rejects bad list parameters", async () => {
    status(await user.session.get("/api/transactions?limit=101"), VALIDATION);
    status(await user.session.get("/api/transactions?type=WRONG"), VALIDATION);
    status(await user.session.get("/api/transactions?page=0"), VALIDATION);
  });

  it("edits a transaction and recalculates the balance", async () => {
    const fresh = await createTestUser("tx-edit");
    const tx = (await addTransaction(fresh, { amount: 10_000 })).json.data;
    assert.equal(await balanceOf(fresh), -10_000);

    status(await fresh.session.put(`/api/transactions/${tx.id}`, { type: "EXPENSE", amount: 30_000, description: "edited" }), 200);
    assert.equal(await balanceOf(fresh), -30_000);

    status(await fresh.session.put(`/api/transactions/${tx.id}`, { type: "INCOME", categoryId: fresh.incomeCategoryId, amount: 30_000 }), 200);
    assert.equal(await balanceOf(fresh), 30_000, "switching expense to income flips the balance");
  });

  it("deletes a transaction and reverses its effect", async () => {
    const fresh = await createTestUser("tx-del");
    const tx = (await addTransaction(fresh, { amount: 45_000 })).json.data;
    assert.equal(await balanceOf(fresh), -45_000);
    status(await fresh.session.delete(`/api/transactions/${tx.id}`), 200);
    assert.equal(await balanceOf(fresh), 0);
    status(await fresh.session.delete(`/api/transactions/${tx.id}`), 404);
    status(await fresh.session.put(`/api/transactions/${MISSING_ID}`, { type: "EXPENSE", amount: 1 }), 404);
  });

  it("replaces a transaction's tags on edit", async () => {
    const [a, b] = await Promise.all([user.session.post("/api/tags", { name: `a-${Date.now()}` }), user.session.post("/api/tags", { name: `b-${Date.now()}` })]);
    const tx = (await addTransaction(user, { tagIds: [a.json.data.id] })).json.data;
    const edited = status(await user.session.put(`/api/transactions/${tx.id}`, { type: "EXPENSE", tagIds: [b.json.data.id] }), 200);
    assert.deepEqual(
      edited.json.data.tags.map((t: { id: string }) => t.id),
      [b.json.data.id],
    );
  });
});

describe("CSV export and import", () => {
  let user: TestUser;
  before(async () => {
    user = await createTestUser("csv");
    await addTransaction(user, { type: "INCOME", categoryId: user.incomeCategoryId, amount: 900_000, description: "Salary, March" });
    await addTransaction(user, { amount: 50_000, description: 'Lunch "special"' });
  });

  it("exports transactions as CSV with quoting", async () => {
    const reply = status(await user.session.get("/api/transactions/export"), 200);
    assert.match(reply.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(reply.headers.get("content-disposition") ?? "", /attachment; filename="transactions-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = reply.text.trim().split("\r\n");
    assert.equal(lines[0], "Date,Type,Amount,Description,Category,Account,To Account,Tags");
    assert.equal(lines.length, 3);
    assert.ok(reply.text.includes('"Salary, March"'), "commas force quoting");
    assert.ok(reply.text.includes('"Lunch ""special"""'), "quotes are doubled");
  });

  it("applies the list filters to the export", async () => {
    const reply = status(await user.session.get("/api/transactions/export?type=INCOME"), 200);
    assert.equal(reply.text.trim().split("\r\n").length, 2);
    status(await user.session.get("/api/transactions/export?type=WRONG"), VALIDATION);
  });

  const upload = (session: Session, csv: string) => {
    const form = new FormData();
    form.set("file", new Blob([csv], { type: "text/csv" }), "import.csv");
    return session.request("POST", "/api/transactions/import", { multipart: form });
  };

  it("imports valid rows, reports bad rows, and creates missing tags", async () => {
    const importer = await createTestUser("csv-import");
    const csv = [
      "Date,Type,Amount,Description,Category,Account,To Account,Tags",
      "2026-01-05,EXPENSE,12000,Coffee,Food & Drinks,Cash,,daily; treat",
      "2026-01-06,INCOME,50000,Refund,Salary,Cash,,",
      "not-a-date,EXPENSE,1,Bad date,Food & Drinks,Cash,,",
      "2026-01-07,EXPENSE,5,Bad category,NoSuchCategory,Cash,,",
      "2026-01-08,EXPENSE,-5,Bad amount,Food & Drinks,Cash,,",
      "2026-01-09,EXPENSE,5,Bad account,Food & Drinks,Nowhere,,",
      "2026-01-10,GIFT,5,Bad type,Food & Drinks,Cash,,",
    ].join("\n");

    const reply = status(await upload(importer.session, csv), 200);
    assert.equal(reply.json.data.created, 2);
    assert.equal(reply.json.data.skipped, 5);
    assert.deepEqual(
      reply.json.data.errors.map((e: { row: number }) => e.row),
      [4, 5, 6, 7, 8],
    );

    assert.equal(await balanceOf(importer), 50_000 - 12_000);
    const tags = (await importer.session.get("/api/tags")).json.data.map((t: { name: string }) => t.name).sort();
    assert.deepEqual(tags, ["daily", "treat"]);
  });

  it("imports what it exported", async () => {
    const original = await createTestUser("csv-roundtrip");
    await addTransaction(original, { amount: 7_000, description: "Round trip" });
    const exported = (await original.session.get("/api/transactions/export")).text;
    const target = await createTestUser("csv-roundtrip-target");
    assert.equal(status(await upload(target.session, exported), 200).json.data.created, 1);
  });

  it("imports a file with hundreds of rows in one go (a 5-second transaction limit used to roll these back)", async () => {
    const importer = await createTestUser("csv-large");
    const rows = 600;
    const csv = [
      "Date,Type,Amount,Description,Category,Account,To Account,Tags",
      ...Array.from({ length: rows }, (_, i) => `2026-02-${String((i % 27) + 1).padStart(2, "0")},EXPENSE,${1000 + i},Row ${i},Food & Drinks,Cash,,bulk`),
    ].join("\n");
    const reply = status(await upload(importer.session, csv), 200);
    assert.equal(reply.json.data.created, rows);
    assert.equal(reply.json.data.skipped, 0);
    assert.equal(await balanceOf(importer), -Array.from({ length: rows }, (_, i) => 1000 + i).reduce((a, b) => a + b, 0));
  });

  it("rejects a missing file", async () => {
    status(await user.session.request("POST", "/api/transactions/import", { multipart: new FormData() }), 400);
  });
});

describe("Recurring transactions", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("rec")));

  const overview = async () => status(await user.session.get("/api/recurring"), 200).json.data;

  it("tracks a new recurring series and flags it overdue", async () => {
    const series = status(await addTransaction(user, { isRecurring: true, recurrenceInterval: "MONTHLY", date: daysAgo(40), description: "Rent" }), 200).json.data;
    assert.equal(series.isRecurring, true);
    assert.ok(series.nextOccurrence);

    const o = await overview();
    const item = o.due.find((d: { transactionId: string }) => d.transactionId === series.id);
    assert.ok(item, "an overdue series appears in the due list");
    assert.equal(item.status, "OVERDUE");
    assert.ok(o.summary.dueCount >= 1 && o.summary.trackedCount >= 1);
  });

  it("lists a future series as upcoming", async () => {
    const series = (await addTransaction(user, { isRecurring: true, recurrenceInterval: "WEEKLY", date: daysAgo(3), description: "Weekly" })).json.data;
    const o = await overview();
    assert.ok(o.upcoming.some((u: { transactionId: string }) => u.transactionId === series.id));
  });

  it("logs an occurrence, keeps tracking, and moves the balance", async () => {
    const fresh = await createTestUser("rec-confirm");
    const series = (await addTransaction(fresh, { isRecurring: true, recurrenceInterval: "MONTHLY", date: daysAgo(35), amount: 100_000, description: "Gym" })).json.data;
    const before = await balanceOf(fresh);

    const logged = status(await fresh.session.post(`/api/recurring/${series.id}/confirm`, { amount: 110_000, description: "Gym (raised)" }), 200).json.data;
    assert.equal(Number(logged.amount), 110_000);
    assert.equal(logged.description, "Gym (raised)");
    assert.equal(logged.isRecurring, true);
    assert.equal(await balanceOf(fresh), before - 110_000);
  });

  it("attaches tags when an occurrence is logged", async () => {
    const tag = (await user.session.post("/api/tags", { name: `rent-${Date.now()}` })).json.data;
    const series = (await addTransaction(user, { isRecurring: true, recurrenceInterval: "MONTHLY", description: "Tagged" })).json.data;
    const logged = status(await user.session.post(`/api/recurring/${series.id}/confirm`, { tagIds: [tag.id] }), 200).json.data;
    assert.deepEqual(
      logged.tags.map((t: { id: string }) => t.id),
      [tag.id],
    );
    assert.equal(list(await user.session.get(`/api/transactions?tagId=${tag.id}`)).length, 1);
  });

  it("logs an occurrence without tags as before", async () => {
    const series = (await addTransaction(user, { isRecurring: true, recurrenceInterval: "MONTHLY" })).json.data;
    assert.deepEqual(status(await user.session.post(`/api/recurring/${series.id}/confirm`, {}), 200).json.data.tags, []);
  });

  it("refuses foreign or unknown tags and invalid input when logging", async () => {
    const other = await createTestUser("rec-foreign");
    const foreign = (await other.session.post("/api/tags", { name: `foreign-${Date.now()}` })).json.data;
    const series = (await addTransaction(user, { isRecurring: true, recurrenceInterval: "MONTHLY" })).json.data;
    status(await user.session.post(`/api/recurring/${series.id}/confirm`, { tagIds: [foreign.id] }), 404);
    status(await user.session.post(`/api/recurring/${series.id}/confirm`, { tagIds: [MISSING_ID] }), 404);
    status(await user.session.post(`/api/recurring/${series.id}/confirm`, { amount: -1 }), VALIDATION);
    status(await user.session.post(`/api/recurring/${series.id}/confirm`, { date: "garbage" }), VALIDATION);
    status(await user.session.post(`/api/recurring/${MISSING_ID}/confirm`, {}), 404);
  });

  it("will not log an occurrence for a transaction with no recurrence", async () => {
    const plain = (await addTransaction(user)).json.data;
    status(await user.session.post(`/api/recurring/${plain.id}/confirm`, {}), 422);
    status(await user.session.post(`/api/recurring/${plain.id}/skip`, {}), 422);
  });

  it("skips an occurrence by moving the schedule forward", async () => {
    const series = (await addTransaction(user, { isRecurring: true, recurrenceInterval: "WEEKLY", date: daysAgo(2) })).json.data;
    const skipped = status(await user.session.post(`/api/recurring/${series.id}/skip`, {}), 200).json.data;
    assert.ok(new Date(skipped.nextOccurrence) > new Date(series.nextOccurrence));
    status(await user.session.post(`/api/recurring/${MISSING_ID}/skip`, {}), 404);
  });

  it("starts and stops tracking an existing transaction", async () => {
    const plain = (await addTransaction(user, { description: "Track me" })).json.data;
    const tracked = status(await user.session.patch(`/api/recurring/${plain.id}`, { isRecurring: true, interval: "BIWEEKLY" }), 200).json.data;
    assert.equal(tracked.recurrenceInterval, "BIWEEKLY");

    const stopped = status(await user.session.patch(`/api/recurring/${plain.id}`, { isRecurring: false }), 200).json.data;
    assert.equal(stopped.isRecurring, false);
    assert.equal(stopped.nextOccurrence, null);

    status(await user.session.patch(`/api/recurring/${plain.id}`, { isRecurring: true }), VALIDATION);
    status(await user.session.patch(`/api/recurring/${plain.id}`, { isRecurring: true, interval: "HOURLY" }), VALIDATION);
    status(await user.session.patch(`/api/recurring/${MISSING_ID}`, { isRecurring: false }), 404);
  });

  it("dismisses and restores a suggestion", async () => {
    const tx = (await addTransaction(user, { description: "Suggestion" })).json.data;
    assert.ok(status(await user.session.post(`/api/recurring/${tx.id}/dismiss`, {}), 200).json.data.affected >= 1);
    assert.ok(status(await user.session.delete(`/api/recurring/${tx.id}/dismiss`), 200).json.data.affected >= 1);
    status(await user.session.post(`/api/recurring/${MISSING_ID}/dismiss`, {}), 404);
    status(await user.session.delete(`/api/recurring/${MISSING_ID}/dismiss`), 404);
  });

  it("detects an untracked monthly pattern from history", async () => {
    const detective = await createTestUser("rec-detect");
    for (let m = 5; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m, 15);
      d.setHours(9, 0, 0, 0);
      await addTransaction(detective, { description: "Streaming plan", amount: 149_000, date: d.toISOString() });
    }
    const o = status(await detective.session.get("/api/recurring"), 200).json.data;
    assert.ok(o.detected.length >= 1, "six identical monthly payments should be suggested as a series");
    assert.equal(o.detected[0].interval, "MONTHLY");
    assert.equal(o.summary.detectedCount, o.detected.length);
  });

  it("validates the overview parameters", async () => {
    status(await user.session.get("/api/recurring?lookaheadDays=0"), VALIDATION);
    status(await user.session.get("/api/recurring?lookaheadDays=91"), VALIDATION);
  });
});

describe("Budgets", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("bud")));
  const { month, year } = monthNow();

  it("creates a budget and counts spending that already happened", async () => {
    await addTransaction(user, { amount: 200_000 });
    const budget = status(await user.session.post("/api/budgets", { categoryId: user.expenseCategoryId, amount: 1_000_000, month, year }), 200).json.data;
    assert.equal(Number(budget.amount), 1_000_000);
    assert.equal(Number(budget.spent), 200_000);
    assert.ok(budget.category);
  });

  it("updates the same budget instead of duplicating it", async () => {
    status(await user.session.post("/api/budgets", { categoryId: user.expenseCategoryId, amount: 1_500_000, month, year }), 200);
    const rows = list(await user.session.get("/api/budgets"));
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].amount), 1_500_000);
  });

  it("tracks new spending and reverses it when a transaction is deleted", async () => {
    const tx = (await addTransaction(user, { amount: 300_000 })).json.data;
    assert.equal(Number(list(await user.session.get("/api/budgets"))[0].spent), 500_000);
    status(await user.session.delete(`/api/transactions/${tx.id}`), 200);
    assert.equal(Number(list(await user.session.get("/api/budgets"))[0].spent), 200_000);
  });

  it("edits amount and auto-renew, then deletes", async () => {
    const id = list(await user.session.get("/api/budgets"))[0].id;
    const updated = status(await user.session.put(`/api/budgets/${id}`, { amount: 2_000_000, autoRenew: true }), 200).json.data;
    assert.equal(Number(updated.amount), 2_000_000);
    assert.equal(updated.autoRenew, true);

    status(await user.session.delete(`/api/budgets/${id}`), 200);
    status(await user.session.delete(`/api/budgets/${id}`), 404);
    status(await user.session.put(`/api/budgets/${MISSING_ID}`, { amount: 1 }), 404);
  });

  it("rejects invalid budgets", async () => {
    for (const body of [
      { categoryId: user.expenseCategoryId, amount: 0, month, year },
      { categoryId: user.expenseCategoryId, amount: 1, month: 13, year },
      { categoryId: user.expenseCategoryId, amount: 1, month: 0, year },
      { categoryId: user.expenseCategoryId, amount: 1, month, year: 1999 },
      { amount: 1, month, year },
    ]) {
      status(await user.session.post("/api/budgets", body), VALIDATION);
    }
    status(await user.session.post("/api/budgets", { categoryId: MISSING_ID, amount: 1, month, year }), 404);
    status(await user.session.put(`/api/budgets/${MISSING_ID}`, { amount: -1 }), VALIDATION);
  });

  it("filters and pages the list by month", async () => {
    const other = { month: month === 1 ? 2 : 1, year };
    status(await user.session.post("/api/budgets", { categoryId: user.expenseCategoryId, amount: 5, ...other }), 200);
    assert.equal(list(await user.session.get(`/api/budgets?month=${other.month}&year=${year}`)).length, 1);
    const paged = status(await user.session.get(`/api/budgets?month=${other.month}&year=${year}&limit=1&page=1`), 200).json.data;
    assert.equal(paged.pagination.limit, 1);
    assert.equal(paged.pagination.totalPages, 1);
  });
});

describe("Goals", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("goal")));

  it("creates a goal with defaults", async () => {
    const goal = status(await user.session.post("/api/goals", { name: "Laptop", targetAmount: 15_000_000 }), 200).json.data;
    assert.equal(goal.status, "ACTIVE");
    assert.equal(Number(goal.currentAmount), 0);
    assert.ok(goal.currency);
  });

  it("rejects invalid goals", async () => {
    status(await user.session.post("/api/goals", { name: "", targetAmount: 1 }), VALIDATION);
    status(await user.session.post("/api/goals", { name: "x", targetAmount: 0 }), VALIDATION);
    status(await user.session.post("/api/goals", { name: "x", targetAmount: 1, currentAmount: -1 }), VALIDATION);
    status(await user.session.post("/api/goals", { name: "x", targetAmount: 1, status: "DONE" }), VALIDATION);
  });

  it("moves progress forward and completes the goal at the target", async () => {
    const goal = (await user.session.post("/api/goals", { name: "Trip", targetAmount: 1_000_000, deadline: "2030-01-01" })).json.data;
    const half = status(await user.session.patch(`/api/goals/${goal.id}/progress`, { currentAmount: 500_000 }), 200).json.data;
    assert.equal(half.status, "ACTIVE");
    const done = status(await user.session.patch(`/api/goals/${goal.id}/progress`, { currentAmount: 1_000_000 }), 200).json.data;
    assert.equal(done.status, "COMPLETED");
    status(await user.session.patch(`/api/goals/${goal.id}/progress`, { currentAmount: -1 }), VALIDATION);
    status(await user.session.patch(`/api/goals/${MISSING_ID}/progress`, { currentAmount: 1 }), 404);
  });

  it("lists goals and filters by status", async () => {
    const active = status(await user.session.get("/api/goals?status=ACTIVE"), 200).json.data;
    const completed = status(await user.session.get("/api/goals?status=COMPLETED"), 200).json.data;
    assert.ok(active.every((g: { status: string }) => g.status === "ACTIVE"));
    assert.ok(completed.length >= 1 && completed.every((g: { status: string }) => g.status === "COMPLETED"));
    assert.ok((await user.session.get("/api/goals")).json.data.length >= active.length + completed.length);
  });

  it("edits, cancels and deletes a goal", async () => {
    const goal = (await user.session.post("/api/goals", { name: "Old name", targetAmount: 100 })).json.data;
    const edited = status(await user.session.put(`/api/goals/${goal.id}`, { name: "New name", status: "CANCELLED" }), 200).json.data;
    assert.equal(edited.name, "New name");
    assert.equal(edited.status, "CANCELLED");
    status(await user.session.delete(`/api/goals/${goal.id}`), 200);
    status(await user.session.delete(`/api/goals/${goal.id}`), 404);
    status(await user.session.put(`/api/goals/${MISSING_ID}`, { name: "x" }), 404);
  });
});

describe("Dashboard and reports", () => {
  let user: TestUser;
  before(async () => {
    user = await createTestUser("dash");
    await addTransaction(user, { type: "INCOME", categoryId: user.incomeCategoryId, amount: 5_000_000, description: "Salary" });
    await addTransaction(user, { amount: 1_200_000, description: "Groceries" });
    await addTransaction(user, { amount: 300_000, description: "Electricity" });
    const { month, year } = monthNow();
    await user.session.post("/api/budgets", { categoryId: user.expenseCategoryId, amount: 2_000_000, month, year });
  });

  it("summarises the month", async () => {
    const d = status(await user.session.get("/api/dashboard/summary"), 200).json.data;
    assert.equal(d.currentMonth.income, 5_000_000);
    assert.equal(d.currentMonth.expense, 1_500_000);
    assert.equal(d.currentMonth.balance, 3_500_000);
    assert.deepEqual(d.currentMonth.counts, { income: 1, expense: 2, transfer: 0, total: 3 });
    assert.equal(d.totalBalance, 3_500_000);
    assert.equal(d.recentTransactions.length, 3);
    assert.equal(d.accounts.length, 1);
    for (const key of ["previousMonth", "changes"]) assert.ok(d[key], key);
  });

  it("builds the dashboard charts", async () => {
    const c = status(await user.session.get("/api/dashboard/charts"), 200).json.data;
    assert.equal(c.monthlyData.length, 6);
    assert.equal(c.monthlyData.at(-1).income, 5_000_000);
    assert.equal(
      c.categoryData.reduce((s: number, x: { value: number }) => s + x.value, 0),
      1_500_000,
    );
    assert.equal(c.budgetProgress[0].spent, 1_500_000);
    assert.equal(Math.round(c.budgetProgress[0].percentage), 75);
    for (const key of ["totalMoved", "totalReceived", "withdrawals"]) assert.ok(key in c.transferSummary, key);
  });

  it("produces the monthly report", async () => {
    const r = status(await user.session.get("/api/reports/monthly"), 200).json.data;
    assert.equal(r.summary.income, 5_000_000);
    assert.equal(r.summary.expense, 1_500_000);
    assert.equal(r.summary.savingsRate, 70);
    assert.equal(r.summary.largestTransaction, 5_000_000);
    assert.equal(r.summary.counts.total, 3);
    assert.equal(r.transactions.length, 3);
    assert.ok(r.topCategories.length >= 1 && r.spendingTrend.length >= 1);

    const { month, year } = monthNow();
    const empty = status(await user.session.get(`/api/reports/monthly?month=${month === 1 ? 2 : 1}&year=${year - 1}`), 200).json.data;
    assert.equal(empty.summary.transactionCount, 0);
  });

  it("produces the yearly report", async () => {
    const r = status(await user.session.get("/api/reports/yearly"), 200).json.data;
    assert.equal(r.monthlyBreakdown.length, 12);
    assert.equal(r.summary.totalIncome, 5_000_000);
    assert.equal(r.summary.yearlyBalance, 3_500_000);
    assert.ok(r.summary.bestMonth && r.summary.worstMonth);
    assert.ok(r.topCategories.length >= 1);
  });

  it("produces a custom-range report and validates the range", async () => {
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const r = status(await user.session.post("/api/reports/custom", { startDate: day(-2), endDate: day(1) }), 200).json.data;
    assert.equal(r.summary.income, 5_000_000);
    assert.equal(r.summary.counts.total, 3);
    assert.ok(r.categoryBreakdown.length >= 1 && r.accountBreakdown.length >= 1 && r.dailyTrend.length >= 1);

    status(await user.session.post("/api/reports/custom", { startDate: day(1), endDate: day(-2) }), 400);
    status(await user.session.post("/api/reports/custom", { startDate: day(0) }), 400);
    status(await user.session.post("/api/reports/custom", {}), 400);
  });
});

describe("Notifications and audit log", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("notif")));

  const waitForNotifications = async (minimum: number) => {
    for (let i = 0; i < 25; i++) {
      const data = (await user.session.get("/api/notifications")).json.data;
      if (data.data.length >= minimum && data.unreadCount >= minimum) return data;
      await new Promise((r) => setTimeout(r, 200));
    }
    return (await user.session.get("/api/notifications")).json.data;
  };

  it("raises a notification when a transaction is recorded", async () => {
    await addTransaction(user, { description: "Notify me", amount: 15_000 });
    const data = await waitForNotifications(1);
    assert.ok(data.data.length >= 1, "a recorded transaction should notify");
    assert.ok(data.unreadCount >= 1);
    assert.equal(data.pagination.page, 1);
  });

  it("marks one and then all notifications read, and deletes one", async () => {
    await addTransaction(user, { description: "Second", amount: 1_000 });
    const data = await waitForNotifications(2);
    const [first] = data.data;

    assert.equal(status(await user.session.patch(`/api/notifications/${first.id}`, {}), 200).json.data.isRead, true);
    status(await user.session.patch("/api/notifications/mark-all-read", {}), 200);
    const after = (await user.session.get("/api/notifications")).json.data;
    assert.equal(after.unreadCount, 0);
    assert.equal((await user.session.get("/api/notifications?unreadOnly=true")).json.data.data.length, 0);

    status(await user.session.delete(`/api/notifications/${first.id}`), 200);
    status(await user.session.delete(`/api/notifications/${first.id}`), 404);
    status(await user.session.patch(`/api/notifications/${MISSING_ID}`, {}), 404);
  });

  it("keeps an audit trail of what the user changed", async () => {
    const acct = (await user.session.post("/api/accounts", { name: "Audited", type: "BANK" })).json.data;
    await user.session.put(`/api/accounts/${acct.id}`, { name: "Audited v2" });
    await user.session.delete(`/api/accounts/${acct.id}`);

    const log = status(await user.session.get("/api/audit-log?entityType=account"), 200).json.data;
    const actions = log.data.filter((e: { entityId: string }) => e.entityId === acct.id).map((e: { action: string }) => e.action);
    assert.deepEqual(actions.sort(), ["create", "delete", "update"]);
    assert.ok(log.data.every((e: { entityType: string }) => e.entityType === "account"));

    const txLog = (await user.session.get("/api/audit-log?entityType=transaction")).json.data;
    assert.ok(txLog.data.length >= 2);
  });

  it("pages and validates the audit log", async () => {
    const paged = status(await user.session.get("/api/audit-log?limit=2&page=1"), 200).json.data;
    assert.ok(paged.data.length <= 2);
    assert.equal(paged.pagination.limit, 2);
    status(await user.session.get("/api/audit-log?entityType=user"), VALIDATION);
    status(await user.session.get("/api/audit-log?limit=101"), VALIDATION);
  });
});

describe("User profile, settings and account lifecycle", () => {
  it("reads and updates the profile", async () => {
    const user = await createTestUser("profile");
    const profile = status(await user.session.get("/api/users/profile"), 200).json.data;
    assert.equal(profile.email, user.email);
    assert.ok(!("password" in profile), "the password hash is never returned");

    assert.equal(status(await user.session.put("/api/users/profile", { name: "Renamed Person" }), 200).json.data.name, "Renamed Person");
    assert.equal((await user.session.get("/api/users/profile")).json.data.name, "Renamed Person");
    status(await user.session.put("/api/users/profile", { name: "x" }), VALIDATION);
    status(await user.session.put("/api/users/profile", {}), VALIDATION);
  });

  it("lists the settings catalogue and changes a value", async () => {
    const user = await createTestUser("settings");
    const settings = status(await user.session.get("/api/users/settings"), 200).json.data as { key: string; value: string }[];
    for (const key of ["language", "theme", "currency", "transactionAlerts", "publicQuickBalances", "recurringLookaheadDays"])
      assert.ok(
        settings.some((s) => s.key === key),
        key,
      );
    assert.equal(settings.find((s) => s.key === "theme")?.value, "system");

    assert.equal(status(await user.session.patch("/api/users/settings/theme", { value: "dark" }), 200).json.data.value, "dark");
    assert.equal((await user.session.get("/api/users/settings")).json.data.find((s: { key: string }) => s.key === "theme").value, "dark");
    status(await user.session.patch("/api/users/settings/no_such_setting", { value: "1" }), 404);
    status(await user.session.patch("/api/users/settings/theme", {}), VALIDATION);
  });

  it("changes the password and invalidates the old one", async () => {
    const user = await createTestUser("pw");
    const next = "NewPassw0rd!";
    status(await user.session.post("/api/users/change-password", { currentPassword: "wrong", newPassword: next }), 401);
    status(await user.session.post("/api/users/change-password", { currentPassword: TEST_PASSWORD, newPassword: "weak" }), VALIDATION);
    status(await user.session.post("/api/users/change-password", { newPassword: next }), VALIDATION);
    status(await user.session.post("/api/users/change-password", { currentPassword: TEST_PASSWORD, newPassword: next }), 200);

    await assert.rejects(new Session().login(user.email, TEST_PASSWORD));
    await new Session().login(user.email, next);
  });

  it("deletes the account and everything in it", async () => {
    const user = await createTestUser("delete");
    await addTransaction(user);
    status(await user.session.delete("/api/users/delete"), 200);
    await assert.rejects(new Session().login(user.email));
    status(await user.session.get("/api/accounts"), 401);
    status(await register(user.email), 200);
  });
});

describe("Quick entry (public, by email)", () => {
  let user: TestUser;
  before(async () => void (user = await createTestUser("quick")));
  const lookup = (email: string) => new Session().get(`/api/quick-transactions?email=${encodeURIComponent(email)}`);

  it("requires an email and knows nobody it hasn't been told about", async () => {
    status(await new Session().get("/api/quick-transactions"), VALIDATION);
    status(await lookup(uniqueEmail("nobody")), 404);
  });

  it("hides balances and activity until the owner opts in", async () => {
    const data = status(await lookup(user.email), 200).json.data;
    assert.equal(data.showsBalances, false);
    assert.equal(data.showsActivity, false);
    assert.ok(data.categories.length === 10 && data.accounts.length === 1);
    assert.ok(!("balance" in data.accounts[0]));
    assert.deepEqual(data.recentTransactions, []);
  });

  it("records a transaction for the owner by email", async () => {
    const reply = status(
      await new Session().post("/api/quick-transactions", {
        email: user.email,
        type: "EXPENSE",
        accountId: user.accountId,
        categoryId: user.expenseCategoryId,
        amount: 18_000,
        description: "Quick coffee",
        date: new Date().toISOString(),
      }),
      200,
    );
    assert.equal(Number(reply.json.data.amount), 18_000);
    assert.equal(await balanceOf(user), -18_000);
  });

  it("rejects invalid, unknown and foreign quick entries", async () => {
    const base = { email: user.email, type: "EXPENSE", accountId: user.accountId, categoryId: user.expenseCategoryId, amount: 1, date: new Date().toISOString() };
    status(await new Session().post("/api/quick-transactions", { ...base, amount: 0 }), VALIDATION);
    status(await new Session().post("/api/quick-transactions", { ...base, email: "nope" }), VALIDATION);
    status(await new Session().post("/api/quick-transactions", { ...base, email: uniqueEmail("nobody") }), 404);
    status(await new Session().post("/api/quick-transactions", { ...base, accountId: MISSING_ID }), 404);
    const stranger = await createTestUser("quick-stranger");
    status(await new Session().post("/api/quick-transactions", { ...base, accountId: stranger.accountId }), 404);
  });

  it("shows balances and activity once the owner allows them", async () => {
    await user.session.get("/api/users/settings");
    status(await user.session.patch("/api/users/settings/publicQuickBalances", { value: "true" }), 200);
    status(await user.session.patch("/api/users/settings/publicQuickActivity", { value: "true" }), 200);
    const data = status(await lookup(user.email), 200).json.data;
    assert.equal(data.showsBalances, true);
    assert.equal(Number(data.accounts[0].balance), -18_000);
    assert.ok(data.recentTransactions.length >= 1);
  });

  it("logs and tracks recurring items from the quick page", async () => {
    const series = (await addTransaction(user, { isRecurring: true, recurrenceInterval: "MONTHLY", date: daysAgo(35), amount: 20_000 })).json.data;
    const plain = (await addTransaction(user, { description: "Track from quick" })).json.data;
    const post = (body: object) => new Session().post("/api/quick-transactions/recurring", { email: user.email, ...body });

    status(await post({ action: "log", transactionId: series.id, amount: 21_000 }), 200);
    status(await post({ action: "track", transactionId: plain.id, interval: "MONTHLY" }), 200);
    status(await post({ action: "track", transactionId: plain.id }), VALIDATION);
    status(await post({ action: "dance", transactionId: series.id }), VALIDATION);
    status(await post({ action: "log", transactionId: MISSING_ID }), 404);
  });

  it("refuses recurring actions when the owner has not allowed them", async () => {
    const closed = await createTestUser("quick-closed");
    const series = (await addTransaction(closed, { isRecurring: true, recurrenceInterval: "MONTHLY" })).json.data;
    status(await new Session().post("/api/quick-transactions/recurring", { email: closed.email, action: "log", transactionId: series.id }), 403);
  });
});

describe("Administration", () => {
  it("keeps app settings away from ordinary users", async () => {
    const user = await createTestUser("notadmin");
    status(await user.session.get("/api/app-settings"), 403);
    status(await user.session.get("/api/app-settings/allow_registration"), 403);
    status(await user.session.post("/api/app-settings", { key: "sneaky", value: "1", label: "Sneaky" }), 403);
    status(await user.session.patch("/api/app-settings/allow_registration", { value: "false" }), 403);
    status(await user.session.delete("/api/app-settings/allow_registration"), 403);
  });

  const admin = process.env.TEST_SUPERADMIN_EMAIL;
  const skip = !admin && "set TEST_SUPERADMIN_EMAIL and TEST_SUPERADMIN_PASSWORD";

  it("lets a superadmin manage app settings", { skip }, async () => {
    const s = new Session();
    await s.login(admin!, process.env.TEST_SUPERADMIN_PASSWORD);

    const all = status(await s.get("/api/app-settings"), 200).json.data;
    assert.ok(all.data.some((x: { key: string }) => x.key === "allow_registration"));
    assert.ok(all.categories.length >= 1);
    assert.ok(status(await s.get("/api/app-settings?search=registration"), 200).json.data.data.length >= 1);

    const key = `test_setting_${Date.now()}`;
    const created = status(await s.post("/api/app-settings", { key, value: "5", type: "number", label: "Test setting", category: "general" }), 200).json.data;
    assert.equal(created.isCatalogue, false);
    status(await s.post("/api/app-settings", { key, value: "5", label: "Duplicate" }), 409);
    status(await s.post("/api/app-settings", { key: "Bad Key", value: "1", label: "x" }), VALIDATION);
    status(await s.post("/api/app-settings", { key: `${key}_n`, value: "abc", type: "number", label: "x" }), VALIDATION);

    assert.ok(
      (await new Session().get("/api/settings")).json.data.some((x: { key: string }) => x.key === key),
      "public settings show it",
    );

    assert.equal(status(await s.patch(`/api/app-settings/${key}`, { value: "6" }), 200).json.data.value, "6");
    status(await s.patch(`/api/app-settings/${key}`, { value: "abc" }), VALIDATION);
    status(await s.patch(`/api/app-settings/${key}`, {}), VALIDATION);
    const detail = status(await s.get(`/api/app-settings/${key}`), 200).json.data;
    assert.equal(detail.history[0].newValue, "6");

    status(await s.delete(`/api/app-settings/${key}`), 200);
    status(await s.get(`/api/app-settings/${key}`), 404);
  });

  it("issues ImageKit upload credentials to signed-in users only", async () => {
    const user = await createTestUser("imagekit");
    const reply = status(await user.session.get("/api/imagekit/upload-auth"), [200, 500]);
    if (reply.status === 200) for (const key of ["token", "expire", "signature", "publicKey"]) assert.ok(reply.json.data[key], key);
  });
});

describe("Data isolation between users", () => {
  let a: TestUser;
  let b: TestUser;
  let ids: Record<string, string>;

  before(async () => {
    [a, b] = await Promise.all([createTestUser("iso-a"), createTestUser("iso-b")]);
    const { month, year } = monthNow();
    const tx = (await addTransaction(a, { description: "A private purchase" })).json.data;
    const series = (await addTransaction(a, { isRecurring: true, recurrenceInterval: "MONTHLY" })).json.data;
    ids = {
      account: (await a.session.post("/api/accounts", { name: "A only", type: "INVESTMENT" })).json.data.id,
      category: (await a.session.post("/api/categories", { name: "A only", type: "EXPENSE" })).json.data.id,
      tag: (await a.session.post("/api/tags", { name: "a-only" })).json.data.id,
      budget: (await a.session.post("/api/budgets", { categoryId: a.expenseCategoryId, amount: 100, month, year })).json.data.id,
      goal: (await a.session.post("/api/goals", { name: "A goal", targetAmount: 100 })).json.data.id,
      tx: tx.id,
      series: series.id,
    };
  });

  it("hides another user's rows from every list", async () => {
    assert.ok(!JSON.stringify(list(await b.session.get("/api/transactions"))).includes("A private purchase"));
    assert.ok(!(await b.session.get("/api/accounts")).text.includes("A only"));
    assert.ok(!(await b.session.get("/api/categories")).text.includes("A only"));
    assert.ok(!(await b.session.get("/api/tags")).text.includes("a-only"));
    assert.equal(list(await b.session.get("/api/budgets")).length, 0);
    assert.equal((await b.session.get("/api/goals")).json.data.length, 0);
    assert.equal((await b.session.get("/api/audit-log")).json.data.data.length, 0);
    assert.equal((await b.session.get("/api/recurring")).json.data.summary.trackedCount, 0);
    assert.ok(!(await b.session.get("/api/transactions/export")).text.includes("A private purchase"));
  });

  it("returns 404 when another user's rows are addressed by id", async () => {
    const attempts: [string, () => Promise<Reply>][] = [
      ["edit account", () => b.session.put(`/api/accounts/${ids.account}`, { name: "hijack" })],
      ["delete account", () => b.session.delete(`/api/accounts/${ids.account}`)],
      ["account history", () => b.session.get(`/api/accounts/${ids.account}/value-history`)],
      ["edit category", () => b.session.put(`/api/categories/${ids.category}`, { name: "hijack" })],
      ["delete category", () => b.session.delete(`/api/categories/${ids.category}`)],
      ["edit tag", () => b.session.put(`/api/tags/${ids.tag}`, { name: "hijack" })],
      ["delete tag", () => b.session.delete(`/api/tags/${ids.tag}`)],
      ["edit budget", () => b.session.put(`/api/budgets/${ids.budget}`, { amount: 1 })],
      ["delete budget", () => b.session.delete(`/api/budgets/${ids.budget}`)],
      ["edit goal", () => b.session.put(`/api/goals/${ids.goal}`, { name: "hijack" })],
      ["goal progress", () => b.session.patch(`/api/goals/${ids.goal}/progress`, { currentAmount: 1 })],
      ["delete goal", () => b.session.delete(`/api/goals/${ids.goal}`)],
      ["edit transaction", () => b.session.put(`/api/transactions/${ids.tx}`, { type: "EXPENSE", amount: 1 })],
      ["delete transaction", () => b.session.delete(`/api/transactions/${ids.tx}`)],
      ["confirm series", () => b.session.post(`/api/recurring/${ids.series}/confirm`, {})],
      ["skip series", () => b.session.post(`/api/recurring/${ids.series}/skip`, {})],
      ["track series", () => b.session.patch(`/api/recurring/${ids.series}`, { isRecurring: false })],
      ["dismiss series", () => b.session.post(`/api/recurring/${ids.series}/dismiss`, {})],
    ];
    for (const [name, attempt] of attempts) assert.equal((await attempt()).status, 404, name);
  });

  it("refuses to post into, categorise with or tag using another user's records", async () => {
    status(await addTransaction(b, { accountId: ids.account }), 404);
    status(await addTransaction(b, { categoryId: ids.category }), 404);
    status(await addTransaction(b, { tagIds: [ids.tag] }), 404);
    status(await b.session.post("/api/budgets", { categoryId: ids.category, amount: 1, ...monthNow() }), 404);
  });

  it("leaves the owner's data exactly as it was", async () => {
    assert.ok((await a.session.get("/api/transactions")).text.includes("A private purchase"));
    assert.ok((await a.session.get("/api/accounts")).text.includes("A only"));
    assert.ok((await a.session.get("/api/tags")).text.includes("a-only"));
    assert.equal((await a.session.get("/api/goals")).json.data[0].name, "A goal");
  });
});

describe("Dashboard pages", () => {
  const pages = ["", "/accounts", "/budgets", "/categories", "/goals", "/transactions", "/reports", "/audit-log", "/profiles", "/settings", "/app-settings"];

  it("renders every screen in every language for a signed-in user", async () => {
    const user = await createTestUser("pages");
    for (const locale of ["en", "id", "zh"]) {
      for (const page of pages) {
        const reply = await user.session.get(`/${locale}/admin/dashboard${page}`);
        assert.equal(reply.status, 200, `/${locale}/admin/dashboard${page} -> ${reply.status}`);
        assert.match(reply.headers.get("content-type") ?? "", /text\/html/);
      }
    }
  });

  it("keeps old recurring URLs working by redirecting them into transactions", async () => {
    const reply = await new Session().get("/en/admin/dashboard/recurring");
    assert.equal(reply.status, 308);
    assert.match(reply.headers.get("location") ?? "", /\/en\/admin\/dashboard\/transactions\?view=recurring/);
  });
});

describe("PDF report", () => {
  const rowsOnPage = 39;
  const expectedPages = (rows: number) => {
    const table = Math.max(1, Math.ceil(rows / rowsOnPage));
    return { min: 1 + table, max: 2 + table };
  };

  describe("through the API", () => {
    let user: TestUser;
    let have = 0;
    before(async () => void (user = await createTestUser("pdf")));

    it("refuses anonymous downloads", async () => {
      status(await new Session().get("/api/users/export"), 401);
    });

    for (const rows of [0, 1, 45, 250]) {
      it(`exports ${rows} transactions as a complete PDF with no blank pages`, async () => {
        await addTransactions(user, rows - have);
        have = rows;

        const reply = status(await user.session.get("/api/users/export"), 200);
        assert.equal(reply.headers.get("content-type"), "application/pdf");
        assert.match(reply.headers.get("content-disposition") ?? "", /attachment; filename="report-\d{4}-\d{2}-\d{2}\.pdf"/);
        assert.equal(reply.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
        assert.equal(Number(reply.headers.get("content-length")), reply.buffer.byteLength);

        const pages = countPdfPages(reply.buffer);
        assert.equal(pages, Number(reply.headers.get("x-report-pages")), "pages in the file must match what the server reports");
        const { min, max } = expectedPages(rows);
        assert.ok(pages >= min && pages <= max, `${pages} pages for ${rows} rows (expected ${min}-${max})`);
      });
    }
  });

  describe("renderer", () => {
    const make = (count: number, overrides: Partial<ReportTransaction> = {}): ReportTransaction[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `tx-${i}`,
        date: new Date(Date.UTC(2026, i % 12, (i % 27) + 1)),
        type: i % 3 === 0 ? "INCOME" : "EXPENSE",
        amount: 10_000 + i,
        category: i % 5 === 0 ? null : { name: `Category ${i % 7}` },
        account: { name: `Account ${i % 3}` },
        ...overrides,
      }));
    const user = { name: "Test User", email: "test@example.com" };

    for (const rows of [0, 1, 36, 37, 38, 39, 40, 100, 500, 2500]) {
      it(`paginates ${rows} rows exactly`, async () => {
        const { buffer, pages } = await buildFinancialReport(user, make(rows));
        const { min, max } = expectedPages(rows);
        assert.equal(countPdfPages(buffer), pages);
        assert.ok(pages >= min && pages <= max, `expected ${min}-${max} pages, got ${pages}`);
      });
    }

    it("grows linearly with the data, never faster (the blank-page bug doubled every page)", async () => {
      const small = await buildFinancialReport(user, make(390));
      const large = await buildFinancialReport(user, make(3900));
      assert.ok(large.pages <= (small.pages - 1) * 10 + 2, `${small.pages} pages for 390 rows vs ${large.pages} for 3900`);
    });

    it("keeps long names on one line", async () => {
      const long = "A very long account or category name that would wrap several times ".repeat(4);
      const { pages } = await buildFinancialReport(user, make(40, { account: { name: long }, category: { name: long } }));
      assert.ok(pages <= expectedPages(40).max);
    });

    it("renders 20,000 rows in a sane time", async () => {
      const started = Date.now();
      const { pages } = await buildFinancialReport(user, make(20_000));
      assert.ok(pages > 100);
      assert.ok(Date.now() - started < 30_000);
    });
  });
});

describe("Kubernetes manifests", () => {
  const good = `
apiVersion: v1
kind: Namespace
metadata: { name: finarthax }
---
apiVersion: v1
kind: ConfigMap
metadata: { name: cfg, namespace: finarthax }
data: { A: "1" }
---
apiVersion: v1
kind: Secret
metadata: { name: sec, namespace: finarthax }
stringData: { B: "2" }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: app, namespace: finarthax }
spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: A
              valueFrom: { configMapKeyRef: { name: cfg, key: A } }
            - name: B
              valueFrom: { secretKeyRef: { name: sec, key: B } }
`;
  const problems = (yaml: string) => validateManifests(parseManifests(yaml));

  it("accepts a consistent set", () => assert.deepEqual(problems(good), []));

  it("rejects the Namespace coming after the things inside it (the kubectl apply -f k8s/ failure)", () => {
    const [namespace, ...rest] = good.split("---");
    assert.match(problems([...rest, namespace].join("---"))[0], /expected Namespace/);
  });

  it("rejects the wrong namespace and dangling config or secret keys", () => {
    assert.ok(problems(good.replace("name: cfg, namespace: finarthax", "name: cfg, namespace: default")).some((p) => /not in the finarthax namespace/.test(p)));
    assert.ok(problems(good.replace("key: A }", "key: MISSING }")).some((p) => /configMapKeyRef cfg\/MISSING/.test(p)));
    assert.ok(problems(good.replace("key: B }", "key: NOPE }")).some((p) => /secretKeyRef sec\/NOPE/.test(p)));
  });

  it("passes for the real manifests when kubectl is available", (t) => {
    try {
      assert.deepEqual(problems(execFileSync("kubectl", ["kustomize", "k8s/"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })), []);
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      t.skip("kubectl or k8s/secret.yaml not available");
    }
  });
});

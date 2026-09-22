/* eslint-disable @typescript-eslint/no-explicit-any -- test helper: replies are untyped JSON that tests assert on, not a modelled API */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { afterEach, beforeEach } from "node:test";

export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const TEST_PASSWORD = "Passw0rd!test";

export interface Reply<T = any> {
  status: number;
  headers: Headers;
  json: T;
  text: string;
  buffer: Buffer;
  ms: number;
}

export interface RequestOptions {
  body?: unknown;
  form?: Record<string, string>;
  multipart?: FormData;
  headers?: Record<string, string>;
}

export interface RecordedCall {
  method: string;
  path: string;
  request: string;
  status: number;
  response: string;
  ms: number;
}

const MAX_CALLS_PER_TEST = 8;
const MAX_BODY = 1200;
const SECRET = /("?(?:password|currentPassword|newPassword|token|csrfToken|secret)"?\s*[:=]\s*)("[^"]*"|[^&,}\s]+)/gi;
const calls = new Map<string, RecordedCall[]>();
let current: string | null = null;

const clip = (text: string) => (text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}… [${text.length - MAX_BODY} more chars]` : text);

const pretty = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const record = (method: string, path: string, options: RequestOptions, response: Response, buffer: Buffer, text: string, ms: number) => {
  if (current === null || /^\/api\/auth\/(csrf|session)/.test(path)) return;
  const list = calls.get(current) ?? [];
  if (list.length >= MAX_CALLS_PER_TEST) return;

  const type = response.headers.get("content-type") ?? "";
  const sent = options.multipart ? "[multipart form data]" : options.form ? new URLSearchParams(options.form).toString() : options.body !== undefined ? JSON.stringify(options.body) : "";
  const readable = /json|text|csv|xml/.test(type);

  list.push({
    method,
    path,
    request: clip(pretty(sent).replace(SECRET, '$1"***"')),
    status: response.status,
    response: readable ? clip(pretty(text).replace(SECRET, '$1"***"')) : `[${type || "no content type"}, ${buffer.length} bytes]`,
    ms: Math.round(ms * 10) / 10,
  });
  calls.set(current, list);
};

export const recordHttp = (file: string) => {
  beforeEach((t) => void (current = (t as { fullName: string }).fullName));
  afterEach(() => void (current = null));
  process.on("exit", () => {
    mkdirSync("tests/reports", { recursive: true });
    writeFileSync(`tests/reports/http-${basename(file).replace(/\.test\.[tj]s$/, "")}.json`, JSON.stringify(Object.fromEntries(calls), null, 2));
  });
};

export class Session {
  private cookies = new Map<string, string>();

  private storeCookies(headers: Headers) {
    for (const line of headers.getSetCookie()) {
      const [pair] = line.split(";");
      const at = pair.indexOf("=");
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      if (value === "" || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async request<T = any>(method: string, path: string, options: RequestOptions = {}): Promise<Reply<T>> {
    const headers: Record<string, string> = { ...options.headers };
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;

    let body: string | FormData | undefined;
    if (options.multipart) {
      body = options.multipart;
    } else if (options.form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(options.form).toString();
    } else if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const started = performance.now();
    const response = await fetch(`${BASE_URL}${path}`, { method, headers, body, redirect: "manual" });
    const buffer = Buffer.from(await response.arrayBuffer());
    const ms = performance.now() - started;

    this.storeCookies(response.headers);

    const text = buffer.toString("utf8");
    let json: any = null;
    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    record(method, path, options, response, buffer, text, ms);

    return { status: response.status, headers: response.headers, json, text, buffer, ms };
  }

  get<T = any>(path: string, headers?: Record<string, string>) {
    return this.request<T>("GET", path, { headers });
  }

  post<T = any>(path: string, body: unknown, headers?: Record<string, string>) {
    return this.request<T>("POST", path, { body, headers });
  }

  put<T = any>(path: string, body: unknown) {
    return this.request<T>("PUT", path, { body });
  }

  patch<T = any>(path: string, body: unknown) {
    return this.request<T>("PATCH", path, { body });
  }

  delete<T = any>(path: string) {
    return this.request<T>("DELETE", path);
  }

  async login(email: string, password: string = TEST_PASSWORD): Promise<void> {
    const csrf = await this.get<{ csrfToken: string }>("/api/auth/csrf");
    const result = await this.request("POST", "/api/auth/callback/credentials", {
      form: { csrfToken: csrf.json.csrfToken, email, password, callbackUrl: BASE_URL, json: "true" },
    });

    if (result.status >= 400) throw new Error(`Login failed with HTTP ${result.status}`);

    const session = await this.get<{ user?: { email: string } }>("/api/auth/session");
    if (session.json?.user?.email !== email) throw new Error(`Login did not create a session for ${email}`);
  }

  async signOut(): Promise<void> {
    const csrf = await this.get<{ csrfToken: string }>("/api/auth/csrf");
    await this.request("POST", "/api/auth/signout", { form: { csrfToken: csrf.json.csrfToken, callbackUrl: BASE_URL, json: "true" } });
  }

  async currentUser(): Promise<{ email: string } | undefined> {
    return (await this.get("/api/auth/session")).json?.user;
  }
}

export const uniqueEmail = (prefix: string) => `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

export const register = async (email: string, name = "Test User", password = TEST_PASSWORD): Promise<Reply> => new Session().post("/api/auth/register", { email, password, name });

export interface TestUser {
  session: Session;
  email: string;
  accountId: string;
  incomeCategoryId: string;
  expenseCategoryId: string;
}

export const createTestUser = async (prefix = "t"): Promise<TestUser> => {
  const email = uniqueEmail(prefix);
  const registered = await register(email);

  if (registered.status === 403) throw new Error("Registration is disabled. Run `npx prisma db seed` so the allow_registration setting exists.");
  if (registered.status >= 300) throw new Error(`Register failed: HTTP ${registered.status} ${registered.text.slice(0, 200)}`);

  const session = new Session();
  await session.login(email);

  const [accounts, categories] = await Promise.all([session.get("/api/accounts"), session.get("/api/categories")]);
  const accountId = accounts.json.data[0].id as string;
  const incomeCategoryId = categories.json.data.find((c: { type: string }) => c.type === "INCOME").id as string;
  const expenseCategoryId = categories.json.data.find((c: { type: string }) => c.type === "EXPENSE").id as string;

  return { session, email, accountId, incomeCategoryId, expenseCategoryId };
};

export const addTransaction = (user: TestUser, overrides: Record<string, unknown> = {}) =>
  user.session.post("/api/transactions", {
    type: "EXPENSE",
    accountId: user.accountId,
    categoryId: user.expenseCategoryId,
    amount: 25_000,
    description: "test transaction",
    date: new Date().toISOString(),
    ...overrides,
  });

export const addTransactions = async (user: TestUser, count: number, concurrency = 10): Promise<void> => {
  for (let i = 0; i < count; i += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, count - i) }, (_, j) => addTransaction(user, { description: `bulk ${i + j}`, amount: 1_000 + i + j }));
    const replies = await Promise.all(batch);
    const failed = replies.find((r) => r.status >= 300);
    if (failed) throw new Error(`Seeding transactions failed: HTTP ${failed.status} ${failed.text.slice(0, 200)}`);
  }
};

export const balanceOf = async (user: TestUser, accountId: string = user.accountId): Promise<number> => {
  const accounts = (await user.session.get("/api/accounts")).json.data as { id: string; balance: string | number }[];
  return Number(accounts.find((a) => a.id === accountId)?.balance);
};

export const daysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();

export const countPdfPages = (buffer: Buffer): number => (buffer.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;

export const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

const sweep = (now: number) => {
  if (windows.size < 5_000) return;
  for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key);
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export const rateLimit = (key: string, limit: number, windowMs: number): RateLimitResult => {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;

  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);

  return { allowed: existing.count <= limit, remaining: Math.max(0, limit - existing.count), retryAfter };
};

export const clientKey = (request: Request, scope: string): string => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${address}`;
};

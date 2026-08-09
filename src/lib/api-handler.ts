import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "prisma-client/client";
import { ZodError, flattenError } from "zod";
import { logger, serializeError } from "./logger";
import { runWithRequestContext, type RequestContext } from "./request-context";
import { isMaintenanceModeEnabled } from "./maintenance";

export const REQUEST_ID_HEADER = "x-request-id";
export const RESPONSE_TIME_HEADER = "x-response-time";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Requests slower than this are logged at `warn` so they surface without reading every line. */
const SLOW_REQUEST_MS = Number(process.env.LOG_SLOW_REQUEST_MS ?? 1_000);

/** Bodies are only mirrored into the logs when explicitly enabled - and never above this size. */
const logRequestBodies = (process.env.LOG_REQUEST_BODY ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true";
const MAX_LOGGED_BODY_BYTES = 8_192;

export type ApiHandler<TParams = unknown> = (request: NextRequest, context: { params: Promise<TParams> }) => Promise<Response> | Response;

export interface ApiOptions {
  /** Run the maintenance-mode check for unsafe methods. Default: true. */
  maintenance?: boolean;
  /**
   * Drop successful requests to `debug`. For endpoints a probe hits every few
   * seconds (health checks), where only the failures are worth keeping.
   */
  quiet?: boolean;
}

interface MappedError {
  status: number;
  message: string;
  /** Extra body fields, e.g. Zod field errors. */
  body?: Record<string, unknown>;
  /** `warn` for expected client mistakes, `error` for genuine faults. */
  level: "warn" | "error";
  /** Short machine-readable tag, e.g. `unauthorized`, `prisma.P2002`. */
  kind: string;
}

const clientIp = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
};

/**
 * Turns anything thrown inside a handler into a response the client can act on,
 * plus enough classification for the logs to be searchable.
 */
const mapError = (error: unknown): MappedError => {
  if (error instanceof Error && error.message === "Unauthorized") {
    return { status: 401, message: "Unauthorized", level: "warn", kind: "unauthorized" };
  }

  if (error instanceof ZodError) {
    const { fieldErrors } = flattenError(error);
    return { status: 422, message: "Validation error", body: { errors: fieldErrors }, level: "warn", kind: "validation" };
  }

  if (error instanceof SyntaxError) {
    return { status: 400, message: "Malformed JSON body", level: "warn", kind: "malformed_body" };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const target = (error.meta?.target as string[] | string | undefined) ?? undefined;
    const field = Array.isArray(target) ? target.join(", ") : target;

    switch (error.code) {
      case "P2002":
        return { status: 409, message: field ? `A record with this ${field} already exists` : "Record already exists", level: "warn", kind: "prisma.P2002" };
      case "P2025":
        return { status: 404, message: "Record not found", level: "warn", kind: "prisma.P2025" };
      case "P2003":
        return { status: 409, message: "This record is still referenced by other data", level: "warn", kind: "prisma.P2003" };
      case "P2024":
        return { status: 503, message: "Database is busy, please retry", level: "error", kind: "prisma.P2024" };
      default:
        return { status: 400, message: "Database request failed", level: "error", kind: `prisma.${error.code}` };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: "Invalid database query", level: "error", kind: "prisma.validation" };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, message: "Database is unavailable", level: "error", kind: "prisma.init" };
  }

  return { status: 500, message: "An unexpected error occurred", level: "error", kind: "unhandled" };
};

/** Reads a copy of the body for logging without consuming the one the handler needs. */
const readBodyForLog = async (request: NextRequest): Promise<unknown> => {
  if (!logRequestBodies || SAFE_METHODS.has(request.method)) return undefined;
  if (!request.headers.get("content-type")?.includes("application/json")) return undefined;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_LOGGED_BODY_BYTES) return `[body omitted: ${declaredLength} bytes]`;

  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
};

/**
 * Wraps a route handler with request/response logging, a request id, maintenance
 * gating and one central error funnel.
 *
 *   export const GET = withApi("accounts.list", async (req) => { ... });
 *   export const PUT = withApi<{ id: string }>("accounts.update", async (req, { params }) => { ... });
 *
 * Handlers no longer need their own try/catch: anything they throw is classified,
 * logged with the full stack and the request id, and returned as a clean JSON error.
 */
export function withApi<TParams = unknown>(name: string, handler: ApiHandler<TParams>, options: ApiOptions = {}): ApiHandler<TParams> {
  const { maintenance = true, quiet = false } = options;

  return async (request, routeContext) => {
    const requestId = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
    const url = new URL(request.url);

    const context: RequestContext = {
      requestId,
      method: request.method,
      path: url.pathname,
      route: name,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      startedAt: Date.now(),
    };

    return runWithRequestContext(context, async () => {
      const startedAt = performance.now();

      logger[quiet ? "debug" : "info"]("request.start", {
        query: Object.fromEntries(url.searchParams) as Record<string, string>,
        ip: context.ip,
        userAgent: context.userAgent,
        body: await readBodyForLog(request),
      });

      let response: Response;

      try {
        if (maintenance && !SAFE_METHODS.has(request.method) && (await isMaintenanceModeEnabled())) {
          logger.warn("request.blocked", { reason: "maintenance_mode" });
          response = NextResponse.json({ success: false, message: "App is under maintenance. Please try again later.", requestId }, { status: 503 });
        } else {
          response = await handler(request, routeContext);
        }
      } catch (error) {
        const mapped = mapError(error);

        logger[mapped.level]("request.failed", {
          status: mapped.status,
          kind: mapped.kind,
          // A ZodError's `message` is the entire issue list; the flattened fields are
          // already in the response, so the stack would be pure noise here.
          ...(mapped.kind === "validation" ? { fields: mapped.body?.errors } : { err: serializeError(error) }),
        });

        // Internal failures never leak their message to the client in production - the
        // request id is what turns a user report into a single log lookup. In development
        // the real message is far more useful than a generic one.
        const isServerFault = mapped.status >= 500;
        const message = isServerFault && process.env.NODE_ENV !== "production" && error instanceof Error ? error.message : mapped.message;

        response = NextResponse.json({ success: false, message, ...mapped.body, requestId }, { status: mapped.status });
      }

      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

      try {
        response.headers.set(REQUEST_ID_HEADER, requestId);
        response.headers.set(RESPONSE_TIME_HEADER, `${durationMs}ms`);
      } catch {
        // Immutable headers (rare, e.g. redirects built from a frozen response) - not worth failing over.
      }

      const level = response.status >= 500 ? "error" : response.status >= 400 || durationMs >= SLOW_REQUEST_MS ? "warn" : quiet ? "debug" : "info";

      logger[level]("request.finish", {
        status: response.status,
        durationMs,
        ...(durationMs >= SLOW_REQUEST_MS && { slow: true }),
      });

      return response;
    });
  };
}

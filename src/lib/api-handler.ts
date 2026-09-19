import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "prisma-client/client";
import { ZodError, flattenError } from "zod";
import { logger, serializeError } from "./logger";
import { runWithRequestContext, type RequestContext } from "./request-context";
import { isMaintenanceModeEnabled } from "./maintenance";

export const REQUEST_ID_HEADER = "x-request-id";
export const RESPONSE_TIME_HEADER = "x-response-time";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Visible ASCII only, capped length - safe both as a reflected header value and as a raw log field. */
const REQUEST_ID_PATTERN = /^[\x21-\x7e]{1,128}$/;

/** Requests slower than this are logged at `warn` so they surface without reading every line. */
const SLOW_REQUEST_MS = Number(process.env.LOG_SLOW_REQUEST_MS ?? 1_000);

/** Bodies are only mirrored into the logs when explicitly enabled - and never above this size. */
const logRequestBodies = (process.env.LOG_REQUEST_BODY ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true";
const MAX_LOGGED_BODY_BYTES = 8_192;

export type ApiHandler<TParams = unknown> = (request: NextRequest, context: { params: Promise<TParams> }) => Promise<Response> | Response;

export interface ApiOptions {
  maintenance?: boolean;
  quiet?: boolean;
}

interface MappedError {
  status: number;
  message: string;
  body?: Record<string, unknown>;
  level: "warn" | "error";
  kind: string;
}

const clientIp = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
};

const mapError = (error: unknown): MappedError => {
  if (error instanceof Error && error.message === "Unauthorized") {
    return { status: 401, message: "Unauthorized", level: "warn", kind: "unauthorized" };
  }

  if (error instanceof Error && error.message === "Forbidden") {
    return { status: 403, message: "You do not have permission to perform this action", level: "warn", kind: "forbidden" };
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

export function withApi<TParams = unknown>(name: string, handler: ApiHandler<TParams>, options: ApiOptions = {}): ApiHandler<TParams> {
  const { maintenance = true, quiet = false } = options;

  return async (request, routeContext) => {
    const incomingRequestId = request.headers.get(REQUEST_ID_HEADER);
    const requestId = incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID();
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
          ...(mapped.kind === "validation" ? { fields: mapped.body?.errors } : { err: serializeError(error) }),
        });

        const isServerFault = mapped.status >= 500;
        const message = isServerFault && process.env.NODE_ENV !== "production" && error instanceof Error ? error.message : mapped.message;

        response = NextResponse.json({ success: false, message, ...mapped.body, requestId }, { status: mapped.status });
      }

      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

      const headers = new Headers(response.headers);
      headers.set(REQUEST_ID_HEADER, requestId);
      headers.set(RESPONSE_TIME_HEADER, `${durationMs}ms`);
      response = new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers });

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

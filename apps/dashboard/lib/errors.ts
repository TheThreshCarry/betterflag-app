/**
 * Error shape shared by every /api/v1 endpoint:
 *   { "error": { "code": string, "message": string } }
 *
 * `withErrors` wraps a route handler and maps:
 *   - HttpError            → its status/code
 *   - zod validation error → 422 validation_error
 *   - Postgres 40001       → 409 version_conflict (update_flag_config)
 *   - Postgres P0002       → 404 not_found
 *   - Postgres 23505       → 409 conflict (unique violations)
 *   - anything else        → 500 internal_error
 */

import { type Logger } from "@shipos/observability";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRequestObservability } from "./observability";

/** Human-readable one-liner for an unknown thrown value. */
function errText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface PostgresErrorLike {
  code: string;
  message: string;
}

function isPostgresErrorLike(err: unknown): err is PostgresErrorLike {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  );
}

export function handleError(err: unknown, log?: Logger): NextResponse {
  if (err instanceof HttpError) {
    return apiError(err.code, err.message, err.status);
  }
  if (err instanceof z.ZodError) {
    const detail = err.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return apiError("validation_error", detail, 422);
  }
  if (isPostgresErrorLike(err)) {
    if (err.code === "40001") return apiError("version_conflict", err.message, 409);
    if (err.code === "P0002") return apiError("not_found", err.message, 404);
    if (err.code === "23505") return apiError("conflict", err.message, 409);
    if (err.code === "23514") return apiError("validation_error", err.message, 422);
  }
  console.error("[api] unhandled error:", err);
  log?.error("unhandled error in API route", {
    status: 500,
    error: errText(err),
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
  });
  return apiError("internal_error", "Something went wrong", 500);
}

type RouteContext<P> = { params: Promise<P> };

/**
 * Wrap an API route handler with uniform error mapping AND observability:
 * a per-request server span, structured request logging (method, path, status,
 * duration), and error capture — all shipped to Better Stack before the
 * response returns. Telemetry never changes the handler's response.
 */
export function withErrors<P = Record<string, never>>(
  handler: (request: NextRequest, context: RouteContext<P>) => Promise<Response>,
): (request: NextRequest, context: RouteContext<P>) => Promise<Response> {
  return async (request, context) => {
    const obs = createRequestObservability();
    const url = new URL(request.url);
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const span = obs.tracer.startSpan(`${request.method} ${url.pathname}`, {
      kind: "server",
      attributes: {
        "http.request.method": request.method,
        "url.path": url.pathname,
        "request.id": requestId,
      },
    });
    const log = obs.logger.child({
      request_id: requestId,
      method: request.method,
      path: url.pathname,
      ...span.logContext,
    });

    try {
      const response = await handler(request, context);
      span.setAttribute("http.response.status_code", response.status);
      if (response.status >= 500) span.setStatus("error");
      span.end();
      const fields = { status: response.status, duration_ms: round(span.durationMs()) };
      if (response.status >= 500) log.error("request", fields);
      else if (response.status >= 400) log.warn("request", fields);
      else log.info("request", fields);
      return response;
    } catch (err) {
      const response = handleError(err, log);
      span.recordException(err).setAttribute("http.response.status_code", response.status).end();
      if (response.status < 500) {
        // Expected, mapped errors (validation, conflicts, not-found) — info level.
        log.info("request", { status: response.status, duration_ms: round(span.durationMs()) });
      }
      return response;
    } finally {
      // Ship logs + spans before returning. Non-hot-path, so awaiting is fine.
      await obs.flush();
    }
  };
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

/** Parse + validate a JSON request body. Invalid JSON → 400, schema failure → 422. */
export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
  return schema.parse(raw);
}

/** Parse + validate query string parameters. Schema failure → 422. */
export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

/** Unwrap a postgrest result, throwing the error (mapped by withErrors). */
export function unwrap<T>(result: { data: T | null; error: { code?: string; message: string } | null }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

/**
 * Dashboard observability wiring (Node runtime).
 *
 * `withErrors` (see lib/errors.ts) builds one request-scoped Observability per
 * API call, spans the request, logs the outcome, and flushes before the
 * response returns. For best-effort structured logs from deeper library code
 * (Cloudflare/ClickHouse helpers) that isn't on the request-object path, use
 * `reportServer*`, it mirrors to console and ships to Better Stack without
 * blocking the caller.
 *
 * Env read (see @betterflag/observability `readObservability`):
 *   BETTER_STACK_SOURCE_TOKEN, BETTER_STACK_LOGS_ENDPOINT   (logs)
 *   OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS  (traces)
 */
import { AsyncLocalStorage } from "node:async_hooks";
import {
  formatRelease,
  readObservability,
  type Fields,
  type Logger,
  type Observability,
  type Span,
} from "@betterflag/observability";
import { VERSION } from "./version.gen";

const SERVICE = "betterflag-dashboard";

export interface RequestObsContext {
  obs: Observability;
  log: Logger;
  span: Span;
}

export const requestObs = new AsyncLocalStorage<RequestObsContext>();

function environment(): string {
  return (
    process.env.BETTERFLAG_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  );
}

function release(): string {
  return formatRelease({
    version: VERSION,
    gitSha: process.env.BETTERFLAG_GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
    override: process.env.BETTERFLAG_RELEASE,
  });
}

/** A fresh, isolated Observability for a single API request. */
export function createRequestObservability(): Observability {
  return readObservability(process.env, SERVICE, {
    environment: environment(),
    release: release(),
    runtime: "node",
  });
}

export async function withBusinessSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attributes?: Fields,
): Promise<T> {
  const current = requestObs.getStore();
  const obs = current?.obs ?? createRequestObservability();
  const parent = current?.span;
  const span = parent
    ? parent.startChild(name, { attributes })
    : obs.tracer.startSpan(name, { attributes });
  try {
    const result = await fn(span);
    span.end();
    if (!current) await obs.flush();
    return result;
  } catch (error) {
    span.recordException(error).end();
    if (!current) await obs.flush();
    throw error;
  }
}

function reportServer(level: "warn" | "error", message: string, fields?: Fields): void {
  try {
    const current = requestObs.getStore();
    if (current) {
      if (level === "error") current.log.error(message, fields);
      else current.log.warn(message, fields);
      return;
    }
    const obs = readObservability(process.env, SERVICE, {
      environment: environment(),
      release: release(),
      console: false,
      runtime: "node",
    });
    if (level === "error") obs.logger.error(message, fields);
    else obs.logger.warn(message, fields);
    void obs.flush();
  } catch {
    // Telemetry must never break the caller.
  }
}

export function reportServerError(message: string, fields?: Fields): void {
  reportServer("error", message, fields);
}

export function reportServerWarn(message: string, fields?: Fields): void {
  reportServer("warn", message, fields);
}

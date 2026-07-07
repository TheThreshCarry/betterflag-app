/**
 * Dashboard observability wiring (Node runtime).
 *
 * `withErrors` (see lib/errors.ts) builds one request-scoped Observability per
 * API call, spans the request, logs the outcome, and flushes before the
 * response returns. For best-effort structured logs from deeper library code
 * (Cloudflare/ClickHouse helpers) that isn't on the request-object path, use
 * `reportServer*` — it mirrors to console and ships to Better Stack without
 * blocking the caller.
 *
 * Env read (see @shipos/observability `readObservability`):
 *   BETTER_STACK_SOURCE_TOKEN, BETTER_STACK_LOGS_ENDPOINT   (logs)
 *   OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS  (traces)
 */
import {
  readObservability,
  type Fields,
  type Observability,
} from "@shipos/observability";

const SERVICE = "shipos-dashboard";

function environment(): string {
  return (
    process.env.SHIPOS_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  );
}

function release(): string | undefined {
  return process.env.SHIPOS_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA;
}

/** A fresh, isolated Observability for a single API request. */
export function createRequestObservability(): Observability {
  return readObservability(process.env, SERVICE, {
    environment: environment(),
    release: release(),
  });
}

/**
 * Fire-and-forget structured log for library-level events that aren't on the
 * request path. Never awaited by the caller and never throws.
 */
function reportServer(level: "warn" | "error", message: string, fields?: Fields): void {
  try {
    const obs = readObservability(process.env, SERVICE, {
      environment: environment(),
      release: release(),
      // Console mirroring is already done at the call sites; avoid duplicate
      // console lines here.
      console: false,
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

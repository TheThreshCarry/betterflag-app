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
import {
  formatRelease,
  readObservability,
  type Fields,
  type Observability,
} from "@betterflag/observability";
import { VERSION } from "./version.gen";

const SERVICE = "betterflag-dashboard";

function environment(): string {
  return (
    process.env.BETTERFLAG_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  );
}

function release(): string {
  // VERSION (this app's committed semver) + the deploy's git commit, so every
  // log/error/trace traces back to exact code. On Vercel the commit comes from
  // VERCEL_GIT_COMMIT_SHA; BETTERFLAG_RELEASE, if set, is used verbatim.
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

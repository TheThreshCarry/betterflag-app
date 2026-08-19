/**
 * Wiring helpers: turn a service name + environment bag into a ready-to-use
 * `{ logger, tracer }` pair, and flush both in one call.
 */
import { createLogger, type Fields, type Logger, type LogLevel } from "./logger";
import { createTracer, type Span, type Tracer } from "./tracer";

export interface Observability {
  logger: Logger;
  tracer: Tracer;
  /** Ship all buffered logs + spans. Best-effort; never throws. */
  flush(): Promise<void>;
  /** Convenience for Workers: `obs.flushTo(ctx.waitUntil.bind(ctx))`. */
  flushTo(waitUntil: (promise: Promise<unknown>) => void): void;
}

export interface ObservabilityConfig {
  service: string;
  environment?: string;
  release?: string;
  logs?: { sourceToken?: string; endpoint?: string; minLevel?: LogLevel };
  traces?: { endpoint?: string; headers?: Record<string, string> };
  fields?: Fields;
  console?: boolean;
  fetchImpl?: typeof fetch;
  /** Worker runtime: console logs + native spans. Node: HTTP logs + OTLP traces. */
  runtime?: "worker" | "node";
}

export function createObservability(config: ObservabilityConfig): Observability {
  const logger = createLogger({
    service: config.service,
    environment: config.environment,
    release: config.release,
    sourceToken: config.logs?.sourceToken,
    endpoint: config.logs?.endpoint,
    minLevel: config.logs?.minLevel,
    fields: config.fields,
    console: config.console,
    fetchImpl: config.fetchImpl,
    runtime: config.runtime,
  });
  const tracer = createTracer({
    service: config.service,
    environment: config.environment,
    release: config.release,
    endpoint: config.traces?.endpoint,
    headers: config.traces?.headers,
    fetchImpl: config.fetchImpl,
    runtime: config.runtime,
  });

  return {
    logger,
    tracer,
    async flush(): Promise<void> {
      await Promise.all([logger.flush(), tracer.flush()]);
    },
    flushTo(waitUntil): void {
      waitUntil(this.flush());
    },
  };
}

/** Loosely-typed environment bag (Worker `env` or `process.env`). */
export type EnvLike = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Compose the `release` string that stamps every log line, error, and trace.
 *
 * The result is the source of truth that ties a telemetry record back to the
 * exact code that produced it:
 *   - `override` (a fully-formed release string, e.g. from CI) always wins.
 *   - otherwise `version` (the app's committed semver) plus, when a git commit
 *     is available, a `+<7-char sha>` suffix → `0.1.2+a1b9f3c`.
 *   - with no sha, just the bare `version` → `0.1.2`.
 *
 * `version` is the per-app value baked in at build time (see each app's
 * `version.gen.ts`); `gitSha` is injected at deploy (e.g. `BETTERFLAG_GIT_SHA`).
 */
export function formatRelease(opts: {
  version: string;
  gitSha?: string;
  override?: string;
}): string {
  const override = opts.override?.trim();
  if (override) return override;
  const sha = opts.gitSha?.trim();
  const short = sha ? sha.slice(0, 7) : "";
  return short ? `${opts.version}+${short}` : opts.version;
}

/**
 * Parse `OTEL_EXPORTER_OTLP_HEADERS`, a comma-separated list of `key=value`
 * pairs (only the first `=` is a separator, so `Authorization=Bearer x` works).
 */
export function parseOtlpHeaders(raw: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  for (const pair of raw.split(",")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

export interface ReadObservabilityOptions {
  environment?: string;
  release?: string;
  minLevel?: LogLevel;
  fields?: Fields;
  console?: boolean;
  fetchImpl?: typeof fetch;
  runtime?: "worker" | "node";
}

/**
 * Build an Observability from a conventional environment bag. Reads:
 *   BETTER_STACK_SOURCE_TOKEN, BETTER_STACK_LOGS_ENDPOINT   (logs)
 *   OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS (traces, optional override)
 *   BETTERFLAG_ENV / ENVIRONMENT, BETTERFLAG_RELEASE                (resource attrs)
 * Missing values degrade gracefully to console-only / no-op tracing.
 *
 * By default traces are sent to the SAME source as logs (the per-service
 * BETTER_STACK source), which gives Better Stack one-click log↔trace
 * correlation. Set OTEL_EXPORTER_OTLP_ENDPOINT (+ _HEADERS) only if you want to
 * route traces to a *different* destination, doing so gives up correlation.
 */
export function readObservability(
  env: EnvLike,
  service: string,
  options: ReadObservabilityOptions = {},
): Observability {
  const logsToken = str(env["BETTER_STACK_SOURCE_TOKEN"]);
  const logsEndpoint = str(env["BETTER_STACK_LOGS_ENDPOINT"]);

  // Traces default to the logs source so logs + spans share one source (the
  // precondition for correlation). An explicit OTEL_* override wins if set.
  const otlpOverrideEndpoint = str(env["OTEL_EXPORTER_OTLP_ENDPOINT"]);
  const otlpOverrideHeaders = parseOtlpHeaders(str(env["OTEL_EXPORTER_OTLP_HEADERS"]));
  const tracesEndpoint = otlpOverrideEndpoint ?? logsEndpoint;
  const tracesHeaders =
    Object.keys(otlpOverrideHeaders).length > 0
      ? otlpOverrideHeaders
      : logsToken
        ? { Authorization: `Bearer ${logsToken}` }
        : {};

  return createObservability({
    service,
    environment: options.environment ?? str(env["BETTERFLAG_ENV"]) ?? str(env["ENVIRONMENT"]) ?? "production",
    release: options.release ?? str(env["BETTERFLAG_RELEASE"]),
    logs: {
      sourceToken: logsToken,
      endpoint: logsEndpoint,
      minLevel: options.minLevel,
    },
    traces: {
      endpoint: tracesEndpoint,
      headers: tracesHeaders,
    },
    fields: options.fields,
    console: options.console,
    fetchImpl: options.fetchImpl,
    runtime: options.runtime ?? "node",
  });
}

/** Attach a span's correlation ids to a logger so its lines link to the trace. */
export function withSpanContext(logger: Logger, span: Span): Logger {
  return logger.child({ ...span.logContext });
}

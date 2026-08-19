/**
 * @betterflag/observability, one small, dependency-free toolkit for structured
 * logging, error capture, and OTLP performance tracing that runs unchanged in
 * Cloudflare Workers and Node. Telemetry is always best-effort: it mirrors to
 * console and never throws into, blocks, or fails the calling code.
 *
 * Typical Worker usage:
 *
 *   attachWorkerTracing(ctx);
 *   const obs = readObservability(env, "betterflag-api", { runtime: "worker" });
 *   const log = obs.logger.child({ request_id });
 *   const span = obs.tracer.startSpan("GET /v1/evaluate", { kind: "server" });
 *   // ... work, span.startChild(...), log.info(...) ...
 *   span.end();
 *   obs.flushTo(ctx.waitUntil.bind(ctx)); // ship without blocking the response
 */
export {
  createLogger,
  type Fields,
  type Logger,
  type LoggerConfig,
  type LogLevel,
} from "./logger";
export {
  createTracer,
  type Span,
  type SpanContext,
  type SpanLogContext,
  type StartSpanOptions,
  type Tracer,
  type TracerConfig,
} from "./tracer";
export type { SpanKind, SpanStatus } from "./otlp";
export {
  createObservability,
  formatRelease,
  parseOtlpHeaders,
  readObservability,
  withSpanContext,
  type EnvLike,
  type Observability,
  type ObservabilityConfig,
  type ReadObservabilityOptions,
} from "./config";
export {
  boundErrorText,
  eventOutcomeFromStatus,
  redactString,
  routeTemplate,
  sanitizeFields,
  type EventOutcome,
} from "./fields";
export {
  attachWorkerTracing,
  installNativeTracing,
  resetNativeTracing,
  type NativeTracing,
  type NativeSpan,
} from "./native";

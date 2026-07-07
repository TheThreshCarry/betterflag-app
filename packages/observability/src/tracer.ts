/**
 * A tiny OTLP tracer. Spans are buffered in memory and shipped as one
 * OTLP/HTTP JSON request on `flush()` — call `flush()` inside
 * `ctx.waitUntil(...)` in Workers so it never blocks the response.
 */
import { epochNanos, monotonicMs, msToNanos, newSpanId, newTraceId } from "./ids";
import {
  buildTracePayload,
  SPAN_KIND,
  STATUS_CODE,
  toKeyValues,
  type OtlpEvent,
  type OtlpSpan,
  type SpanKind,
  type SpanStatus,
} from "./otlp";

export interface SpanContext {
  traceId: string;
  spanId: string;
}

export interface StartSpanOptions {
  kind?: SpanKind;
  parent?: SpanContext;
  attributes?: Record<string, unknown>;
}

/**
 * Nested log fields that let Better Stack link a log line to its span. The
 * nested `span` object maps to the queryable `.span.trace_id` / `.span.span_id`
 * paths on ingest (a flat `"span.trace_id"` key would NOT). Correlation also
 * requires the log and the trace to be in the SAME source.
 */
export interface SpanLogContext {
  span: { trace_id: string; span_id: string };
}

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  /** Fields to attach to a correlated log line so Better Stack links the two. */
  readonly logContext: SpanLogContext;
  setAttribute(key: string, value: unknown): this;
  setAttributes(attributes: Record<string, unknown>): this;
  addEvent(name: string, attributes?: Record<string, unknown>): this;
  recordException(error: unknown): this;
  setStatus(status: SpanStatus, message?: string): this;
  startChild(name: string, options?: Omit<StartSpanOptions, "parent">): Span;
  end(): void;
  /** Milliseconds elapsed so far (or total, once ended). */
  durationMs(): number;
}

export interface TracerConfig {
  service: string;
  environment?: string;
  release?: string;
  /** OTLP base URL, e.g. https://sXXXX.eu-fsn-3.betterstackdata.com (no /v1/traces). */
  endpoint?: string;
  headers?: Record<string, string>;
  scopeName?: string;
  scopeVersion?: string;
  /** Optional override for tests. */
  fetchImpl?: typeof fetch;
}

export interface Tracer {
  startSpan(name: string, options?: StartSpanOptions): Span;
  withSpan<T>(
    name: string,
    fn: (span: Span) => T | Promise<T>,
    options?: StartSpanOptions,
  ): Promise<T>;
  /** Ship + clear all finished spans. Best-effort; never throws. */
  flush(): Promise<void>;
  readonly enabled: boolean;
}

class SpanImpl implements Span {
  readonly traceId: string;
  readonly spanId: string;
  private readonly parentSpanId: string | undefined;
  private readonly kind: SpanKind;
  private readonly name: string;
  private readonly startNanos: bigint;
  private readonly startMono: number;
  private readonly attributes: Record<string, unknown> = {};
  private readonly events: OtlpEvent[] = [];
  private status: SpanStatus = "unset";
  private statusMessage: string | undefined;
  private endedMono: number | undefined;
  private ended = false;

  constructor(
    private readonly sink: (span: OtlpSpan) => void,
    name: string,
    options: StartSpanOptions,
  ) {
    this.name = name;
    this.kind = options.kind ?? "internal";
    this.traceId = options.parent?.traceId ?? newTraceId();
    this.spanId = newSpanId();
    this.parentSpanId = options.parent?.spanId;
    this.startNanos = epochNanos();
    this.startMono = monotonicMs();
    if (options.attributes) this.setAttributes(options.attributes);
  }

  get logContext(): SpanLogContext {
    return { span: { trace_id: this.traceId, span_id: this.spanId } };
  }

  setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(attributes)) this.attributes[key] = value;
    return this;
  }

  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.events.push({
      timeUnixNano: (this.startNanos + msToNanos(monotonicMs() - this.startMono)).toString(),
      name,
      attributes: attributes ? toKeyValues(attributes) : undefined,
    });
    return this;
  }

  recordException(error: unknown): this {
    const message = error instanceof Error ? error.message : String(error);
    const type = error instanceof Error ? error.name : "Error";
    this.addEvent("exception", {
      "exception.type": type,
      "exception.message": message,
      ...(error instanceof Error && error.stack ? { "exception.stacktrace": error.stack } : {}),
    });
    return this.setStatus("error", message);
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.status = status;
    if (message !== undefined) this.statusMessage = message;
    return this;
  }

  startChild(name: string, options?: Omit<StartSpanOptions, "parent">): Span {
    return new SpanImpl(this.sink, name, {
      ...options,
      parent: { traceId: this.traceId, spanId: this.spanId },
    });
  }

  durationMs(): number {
    return (this.endedMono ?? monotonicMs()) - this.startMono;
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.endedMono = monotonicMs();
    const endNanos = this.startNanos + msToNanos(this.endedMono - this.startMono);
    this.attributes["duration_ms"] = Math.round(this.durationMs() * 1000) / 1000;
    this.sink({
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: SPAN_KIND[this.kind],
      startTimeUnixNano: this.startNanos.toString(),
      endTimeUnixNano: endNanos.toString(),
      attributes: toKeyValues(this.attributes),
      events: this.events.length > 0 ? this.events : undefined,
      status:
        this.status === "unset"
          ? undefined
          : { code: STATUS_CODE[this.status], message: this.statusMessage },
    });
  }
}

export function createTracer(config: TracerConfig): Tracer {
  const endpoint = config.endpoint?.replace(/\/+$/, "");
  const enabled = typeof endpoint === "string" && endpoint.length > 0;
  const fetchImpl = config.fetchImpl ?? fetch;
  const scope = { name: config.scopeName ?? config.service, version: config.scopeVersion };
  const resourceAttributes: Record<string, unknown> = {
    "service.name": config.service,
    "deployment.environment": config.environment,
    "service.version": config.release,
  };

  let buffer: OtlpSpan[] = [];
  const sink = (span: OtlpSpan): void => {
    buffer.push(span);
  };

  const startSpan = (name: string, options: StartSpanOptions = {}): Span =>
    new SpanImpl(sink, name, options);

  return {
    enabled,
    startSpan,
    async withSpan<T>(
      name: string,
      fn: (span: Span) => T | Promise<T>,
      options?: StartSpanOptions,
    ): Promise<T> {
      const span = startSpan(name, options);
      try {
        const result = await fn(span);
        span.end();
        return result;
      } catch (error) {
        span.recordException(error);
        span.end();
        throw error;
      }
    },
    async flush(): Promise<void> {
      if (!enabled || buffer.length === 0) return;
      const spans = buffer;
      buffer = [];
      const payload = buildTracePayload(resourceAttributes, scope, spans);
      try {
        await fetchImpl(`${endpoint}/v1/traces`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(config.headers ?? {}) },
          body: JSON.stringify(payload),
        });
      } catch {
        // Best-effort: a telemetry failure must never surface to callers.
      }
    },
  };
}

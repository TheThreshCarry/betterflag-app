/**
 * Tracer: Node ships OTLP/HTTP JSON on flush(); Workers use Cloudflare native
 * spans when `installNativeTracing` has been called (no extra POST).
 */
import { boundErrorText, sanitizeFields } from "./fields";
import { epochNanos, monotonicMs, msToNanos, newSpanId, newTraceId } from "./ids";
import { nativeTracing, type NativeSpan, type NativeTracing } from "./native";
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

export interface SpanLogContext {
  span: { trace_id: string; span_id: string };
}

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly logContext: SpanLogContext;
  setAttribute(key: string, value: unknown): this;
  setAttributes(attributes: Record<string, unknown>): this;
  addEvent(name: string, attributes?: Record<string, unknown>): this;
  recordException(error: unknown): this;
  setStatus(status: SpanStatus, message?: string): this;
  startChild(name: string, options?: Omit<StartSpanOptions, "parent">): Span;
  end(): void;
  durationMs(): number;
}

export interface TracerConfig {
  service: string;
  environment?: string;
  release?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  scopeName?: string;
  scopeVersion?: string;
  fetchImpl?: typeof fetch;
  runtime?: "worker" | "node";
}

export interface Tracer {
  startSpan(name: string, options?: StartSpanOptions): Span;
  withSpan<T>(
    name: string,
    fn: (span: Span) => T | Promise<T>,
    options?: StartSpanOptions,
  ): Promise<T>;
  flush(): Promise<void>;
  readonly enabled: boolean;
}

function scalarAttr(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return typeof value === "string" ? value.slice(0, 500) : value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value)?.slice(0, 500);
  } catch {
    return String(value).slice(0, 500);
  }
}

function applyNativeAttrs(native: NativeSpan, attributes: Record<string, unknown> | undefined): void {
  if (!attributes) return;
  const clean = sanitizeFields(attributes);
  for (const [key, value] of Object.entries(clean)) {
    const scalar = scalarAttr(value);
    if (scalar !== undefined) native.setAttribute(key, scalar);
  }
}

class NativeSpanAdapter implements Span {
  readonly traceId: string;
  readonly spanId: string;
  private readonly startMono: number;
  private endedMono: number | undefined;
  private ended = false;

  constructor(
    private readonly tracing: NativeTracing,
    private readonly native: NativeSpan,
    name: string,
    options: StartSpanOptions,
  ) {
    this.traceId = options.parent?.traceId ?? newTraceId();
    this.spanId = newSpanId();
    this.startMono = monotonicMs();
    native.setAttribute("betterflag.span_name", name);
    native.setAttribute("betterflag.trace_id", this.traceId);
    native.setAttribute("betterflag.span_id", this.spanId);
    if (options.kind) native.setAttribute("span.kind", options.kind);
    applyNativeAttrs(native, options.attributes);
  }

  get logContext(): SpanLogContext {
    return { span: { trace_id: this.traceId, span_id: this.spanId } };
  }

  setAttribute(key: string, value: unknown): this {
    applyNativeAttrs(this.native, { [key]: value });
    return this;
  }

  setAttributes(attributes: Record<string, unknown>): this {
    applyNativeAttrs(this.native, attributes);
    return this;
  }

  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.native.setAttribute(`event.${name}`, true);
    applyNativeAttrs(this.native, attributes);
    return this;
  }

  recordException(error: unknown): this {
    const message = boundErrorText(error);
    const type = error instanceof Error ? error.name : "Error";
    this.native.setAttribute("exception.type", type.slice(0, 200));
    this.native.setAttribute("exception.message", message);
    return this.setStatus("error", message);
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.native.setAttribute("otel.status_code", status);
    if (message) this.native.setAttribute("otel.status_description", message.slice(0, 500));
    return this;
  }

  startChild(name: string, options?: Omit<StartSpanOptions, "parent">): Span {
    return this.tracing.startActiveSpan(name, (child) => {
      return new NativeSpanAdapter(this.tracing, child, name, {
        ...options,
        parent: { traceId: this.traceId, spanId: this.spanId },
      });
    });
  }

  durationMs(): number {
    return (this.endedMono ?? monotonicMs()) - this.startMono;
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.endedMono = monotonicMs();
    this.native.setAttribute("duration_ms", Math.round(this.durationMs() * 1000) / 1000);
    this.native.end?.();
  }
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
    const clean = sanitizeFields({ [key]: value });
    Object.assign(this.attributes, clean);
    return this;
  }

  setAttributes(attributes: Record<string, unknown>): this {
    Object.assign(this.attributes, sanitizeFields(attributes));
    return this;
  }

  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.events.push({
      timeUnixNano: (this.startNanos + msToNanos(monotonicMs() - this.startMono)).toString(),
      name,
      attributes: attributes ? toKeyValues(sanitizeFields(attributes)) : undefined,
    });
    return this;
  }

  recordException(error: unknown): this {
    const message = boundErrorText(error);
    const type = error instanceof Error ? error.name : "Error";
    this.addEvent("exception", {
      "exception.type": type,
      "exception.message": message,
      ...(error instanceof Error && error.stack
        ? { "exception.stacktrace": boundErrorText(error.stack) }
        : {}),
    });
    return this.setStatus("error", message);
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.status = status;
    if (message !== undefined) this.statusMessage = message.slice(0, 500);
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
  const native = config.runtime === "worker" ? nativeTracing() : undefined;
  const endpoint = config.endpoint?.replace(/\/+$/, "");
  const otlpEnabled = config.runtime !== "worker" && typeof endpoint === "string" && endpoint.length > 0;
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

  const startSpan = (name: string, options: StartSpanOptions = {}): Span => {
    if (native) {
      return native.startActiveSpan(name, (span) => new NativeSpanAdapter(native, span, name, options));
    }
    return new SpanImpl(sink, name, options);
  };

  return {
    enabled: Boolean(native) || otlpEnabled,
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
      if (!otlpEnabled || buffer.length === 0) return;
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
        // Best-effort.
      }
    },
  };
}

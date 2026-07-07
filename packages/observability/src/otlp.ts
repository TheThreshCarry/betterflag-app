/**
 * Minimal OTLP/HTTP JSON encoding. We deliberately avoid the full
 * OpenTelemetry SDK: it is heavy for the edge hot path and pulls Node-only
 * shims into Workers. OTLP is just an HTTP+JSON contract, so we build the
 * `ExportTraceServiceRequest` payload by hand.
 *
 * Spec: https://betterstack.com/docs/logs/ingesting-data/http/traces/
 */

/** OTLP `AnyValue` — the subset of scalar types we emit. */
export type OtlpAnyValue =
  | { stringValue: string }
  | { boolValue: boolean }
  | { intValue: string }
  | { doubleValue: number };

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

/** span.kind integers per the OTLP spec. */
export const SPAN_KIND = {
  internal: 1,
  server: 2,
  client: 3,
  producer: 4,
  consumer: 5,
} as const;

export type SpanKind = keyof typeof SPAN_KIND;

/** status.code: 0 unset, 1 ok, 2 error. */
export const STATUS_CODE = { unset: 0, ok: 1, error: 2 } as const;

export type SpanStatus = keyof typeof STATUS_CODE;

export function toAnyValue(value: unknown): OtlpAnyValue {
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "bigint") return { intValue: value.toString() };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  return { stringValue: safeJson(value) };
}

export function toKeyValues(attributes: Record<string, unknown>): OtlpKeyValue[] {
  const out: OtlpKeyValue[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    out.push({ key, value: toAnyValue(value) });
  }
  return out;
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface OtlpEvent {
  timeUnixNano: string;
  name: string;
  attributes?: OtlpKeyValue[];
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtlpKeyValue[];
  events?: OtlpEvent[];
  status?: { code: number; message?: string };
}

export interface ExportTraceServiceRequest {
  resourceSpans: Array<{
    resource: { attributes: OtlpKeyValue[] };
    scopeSpans: Array<{
      scope: { name: string; version?: string };
      spans: OtlpSpan[];
    }>;
  }>;
}

export function buildTracePayload(
  resourceAttributes: Record<string, unknown>,
  scope: { name: string; version?: string },
  spans: OtlpSpan[],
): ExportTraceServiceRequest {
  return {
    resourceSpans: [
      {
        resource: { attributes: toKeyValues(resourceAttributes) },
        scopeSpans: [{ scope, spans }],
      },
    ],
  };
}

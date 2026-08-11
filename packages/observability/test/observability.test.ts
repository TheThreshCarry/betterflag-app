import { describe, expect, it, vi } from "vitest";
import { createObservability, formatRelease, parseOtlpHeaders, readObservability } from "../src/config";

function jsonBodies(fetchMock: ReturnType<typeof vi.fn>): Array<{ url: string; body: unknown }> {
  return fetchMock.mock.calls.map((call) => ({
    url: String(call[0]),
    body: JSON.parse(String((call[1] as RequestInit).body)),
  }));
}

describe("parseOtlpHeaders", () => {
  it("splits on the first '=' only so Bearer tokens survive", () => {
    expect(parseOtlpHeaders("Authorization=Bearer abc123,X-Env=prod")).toEqual({
      Authorization: "Bearer abc123",
      "X-Env": "prod",
    });
  });

  it("returns an empty object for undefined", () => {
    expect(parseOtlpHeaders(undefined)).toEqual({});
  });
});

describe("formatRelease", () => {
  it("appends the short git sha to the version", () => {
    expect(formatRelease({ version: "0.1.2", gitSha: "a1b9f3c9d0e1f2" })).toBe("0.1.2+a1b9f3c");
  });

  it("returns the bare version when no sha is available", () => {
    expect(formatRelease({ version: "0.1.2" })).toBe("0.1.2");
    expect(formatRelease({ version: "0.1.2", gitSha: "" })).toBe("0.1.2");
  });

  it("lets an explicit override win over version + sha", () => {
    expect(
      formatRelease({ version: "0.1.2", gitSha: "a1b9f3c", override: "0.9.0+ci" }),
    ).toBe("0.9.0+ci");
  });
});

describe("logger", () => {
  it("ships buffered records to the logs endpoint with a bearer token", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const obs = createObservability({
      service: "test",
      environment: "test",
      logs: { sourceToken: "tok", endpoint: "https://logs.example.com" },
      console: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    obs.logger.info("hello", { foo: 1 });
    obs.logger.error("boom", { code: "x" });
    await obs.flush();

    const posts = jsonBodies(fetchMock).filter((p) => p.url === "https://logs.example.com/");
    expect(posts).toHaveLength(1);
    const records = posts[0]!.body as Array<Record<string, unknown>>;
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ level: "info", message: "hello", service: "test", foo: 1 });
    expect(records[1]).toMatchObject({ level: "error", message: "boom", code: "x" });
    expect(records[0]!.dt).toEqual(expect.any(String));
  });

  it("drops records below minLevel", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const obs = createObservability({
      service: "test",
      logs: { sourceToken: "tok", endpoint: "https://logs.example.com", minLevel: "warn" },
      console: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    obs.logger.info("skip me");
    obs.logger.warn("keep me");
    await obs.flush();
    const records = jsonBodies(fetchMock)[0]!.body as unknown[];
    expect(records).toHaveLength(1);
  });

  it("is console-only (no fetch) when no token/endpoint is configured", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    const obs = createObservability({
      service: "test",
      console: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    obs.logger.error("no sink");
    await obs.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readObservability trace routing (correlation)", () => {
  function recordingFetch() {
    let url = "";
    let auth: string | null = null;
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      url = String(input);
      auth = new Headers(init?.headers).get("Authorization");
      return new Response("{}", { status: 200 });
    });
    return { fn: fn as unknown as typeof fetch, seen: () => ({ url, auth }) };
  }

  it("defaults traces to the logs source + token when OTEL_* is unset", async () => {
    const f = recordingFetch();
    const obs = readObservability(
      {
        BETTER_STACK_SOURCE_TOKEN: "src-tok",
        BETTER_STACK_LOGS_ENDPOINT: "https://s1.betterstackdata.com",
      },
      "betterflag-api",
      { console: false, fetchImpl: f.fn },
    );
    obs.tracer.startSpan("x").end();
    await obs.flush();
    expect(f.seen().url).toBe("https://s1.betterstackdata.com/v1/traces");
    expect(f.seen().auth).toBe("Bearer src-tok");
  });

  it("honors an explicit OTEL_* override (giving up correlation)", async () => {
    const f = recordingFetch();
    const obs = readObservability(
      {
        BETTER_STACK_SOURCE_TOKEN: "src-tok",
        BETTER_STACK_LOGS_ENDPOINT: "https://s1.betterstackdata.com",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com",
        OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer otel-tok",
      },
      "betterflag-api",
      { console: false, fetchImpl: f.fn },
    );
    obs.tracer.startSpan("x").end();
    await obs.flush();
    expect(f.seen().url).toBe("https://otel.example.com/v1/traces");
    expect(f.seen().auth).toBe("Bearer otel-tok");
  });
});

describe("tracer", () => {
  it("emits a well-formed OTLP payload with parent/child linkage and timing", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const obs = createObservability({
      service: "svc",
      environment: "test",
      traces: { endpoint: "https://otel.example.com", headers: { Authorization: "Bearer t" } },
      console: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const root = obs.tracer.startSpan("root", { kind: "server", attributes: { "http.route": "/x" } });
    const child = root.startChild("db.query", { kind: "client" });
    child.setAttribute("db.system", "postgres");
    child.end();
    root.setStatus("ok");
    root.end();
    await obs.flush();

    const [post] = jsonBodies(fetchMock);
    expect(post!.url).toBe("https://otel.example.com/v1/traces");
    const payload = post!.body as {
      resourceSpans: Array<{
        resource: { attributes: Array<{ key: string; value: Record<string, unknown> }> };
        scopeSpans: Array<{ spans: Array<Record<string, unknown>> }>;
      }>;
    };
    const resourceAttrs = payload.resourceSpans[0]!.resource.attributes;
    expect(resourceAttrs).toContainEqual({ key: "service.name", value: { stringValue: "svc" } });

    const spans = payload.resourceSpans[0]!.scopeSpans[0]!.spans;
    expect(spans).toHaveLength(2);
    const rootSpan = spans.find((s) => s.name === "root")!;
    const childSpan = spans.find((s) => s.name === "db.query")!;
    expect(rootSpan.traceId).toBe(childSpan.traceId);
    expect(childSpan.parentSpanId).toBe(rootSpan.spanId);
    expect(String(rootSpan.traceId)).toHaveLength(32);
    expect(String(rootSpan.spanId)).toHaveLength(16);
    expect(rootSpan.status).toEqual({ code: 1, message: undefined });
  });

  it("exposes a nested span.logContext that maps to Better Stack .span.* fields", () => {
    const obs = createObservability({ service: "svc", console: false });
    const span = obs.tracer.startSpan("root");
    expect(span.logContext).toEqual({
      span: { trace_id: span.traceId, span_id: span.spanId },
    });
  });

  it("withSpan records exceptions and still rethrows", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const obs = createObservability({
      service: "svc",
      traces: { endpoint: "https://otel.example.com" },
      console: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(
      obs.tracer.withSpan("work", () => {
        throw new Error("kaboom");
      }),
    ).rejects.toThrow("kaboom");
    await obs.flush();
    const payload = jsonBodies(fetchMock)[0]!.body as {
      resourceSpans: Array<{ scopeSpans: Array<{ spans: Array<Record<string, unknown>> }> }>;
    };
    const span = payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(span.status).toMatchObject({ code: 2, message: "kaboom" });
    expect((span.events as unknown[]) ?? []).toHaveLength(1);
  });
});

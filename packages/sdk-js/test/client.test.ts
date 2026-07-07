import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient, type EvaluationResult, type JsonValue } from "../src/index";

// ---------------------------------------------------------------- helpers

interface FakeResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * A plain-object Response stand-in whose json() settles on the microtask
 * queue, keeps fake-timer tests free of real stream/undici timing.
 */
function fakeResponse(body: unknown, init: FakeResponseInit = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(init.headers ?? {}),
    json: async () => body,
  } as unknown as Response;
}

function evaluateResponse(results: EvaluationResult[], version = 1): Response {
  return fakeResponse({ version, results });
}

function snapshotResponse(version: number): Response {
  return fakeResponse(
    { version, projectId: "p", environment: "dev", generatedAt: "", flags: {} },
    { headers: { ETag: `"v${version}"` } },
  );
}

function result(
  key: string,
  value: JsonValue,
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return { key, value, variation: "on", reason: "rollout", ...overrides };
}

interface Route {
  evaluate?: (init: RequestInit | undefined) => Response | Promise<Response>;
  snapshot?: (init: RequestInit | undefined) => Response | Promise<Response>;
}

function mockFetch(routes: Route) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/v1/evaluate") && routes.evaluate) return routes.evaluate(init);
    if (url.endsWith("/v1/snapshot") && routes.snapshot) return routes.snapshot(init);
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.[name];
}

function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(String(init?.body));
}

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------- flag()

describe("flag()", () => {
  it("returns the evaluated value and sends auth + SDK headers and the context", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "sos_sdk_test", fetch, refreshInterval: 0 });

    const value = await client.flag("checkout", {
      userId: "u1",
      attributes: { plan: "pro" },
      default: false,
    });

    expect(value).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://edge.shipos.app/v1/evaluate");
    expect(init?.method).toBe("POST");
    expect(headerOf(init, "Authorization")).toBe("Bearer sos_sdk_test");
    expect(headerOf(init, "X-ShipOS-SDK")).toBe("js/0.1.0");
    expect(bodyOf(init)).toEqual({
      key: "checkout",
      context: { userId: "u1", attributes: { plan: "pro" } },
    });
    client.close();
  });

  it("supports non-boolean kinds (string, number, json)", async () => {
    const values: Record<string, JsonValue> = {
      theme: "dark",
      limit: 42,
      config: { retries: 3, hosts: ["a", "b"] },
    };
    const fetch = mockFetch({
      evaluate: (init) => {
        const { key } = bodyOf(init) as { key: string };
        return evaluateResponse([result(key, values[key] ?? null)]);
      },
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await expect(client.flag("theme", { default: "light" })).resolves.toBe("dark");
    await expect(client.flag("limit", { default: 0 })).resolves.toBe(42);
    await expect(
      client.flag<{ retries: number; hosts: string[] }>("config", {
        default: { retries: 0, hosts: [] },
      }),
    ).resolves.toEqual({ retries: 3, hosts: ["a", "b"] });
    client.close();
  });

  it("returns the default on network error (never throws) and reports via onError", async () => {
    const onError = vi.fn();
    const fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof globalThis.fetch;
    const client = createClient({ key: "k", fetch, refreshInterval: 0, onError });

    await expect(client.flag("checkout", { default: false })).resolves.toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("returns the default on HTTP 500", async () => {
    const fetch = mockFetch({ evaluate: () => fakeResponse("boom", { status: 500 }) });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await expect(client.flag("checkout", { default: "fallback" })).resolves.toBe(
      "fallback",
    );
    client.close();
  });

  it("returns the default when the flag is not found", async () => {
    const fetch = mockFetch({
      evaluate: () =>
        evaluateResponse([
          result("ghost", null, { variation: "default", reason: "not_found" }),
        ]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await expect(client.flag("ghost", { default: 7 })).resolves.toBe(7);
    client.close();
  });
});

// ---------------------------------------------------------------- cache

describe("evaluation cache", () => {
  it("serves the second identical call from cache (single fetch inside TTL)", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await client.flag("checkout", { userId: "u1", default: false });
    await client.flag("checkout", { userId: "u1", default: false });

    expect(fetch).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("treats attribute objects with different key order as the same cache entry", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await client.flag("checkout", { attributes: { a: 1, b: 2 }, default: false });
    await client.flag("checkout", { attributes: { b: 2, a: 1 }, default: false });

    expect(fetch).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("fetches separately for different users", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await client.flag("checkout", { userId: "u1", default: false });
    await client.flag("checkout", { userId: "u2", default: false });

    expect(fetch).toHaveBeenCalledTimes(2);
    client.close();
  });
});

// ---------------------------------------------------------------- flagDetail

describe("flagDetail()", () => {
  it("returns the full evaluation result", async () => {
    const fetch = mockFetch({
      evaluate: () =>
        evaluateResponse([
          result("checkout", true, { reason: "rule_match", ruleId: "r1" }),
        ]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    const detail = await client.flagDetail("checkout", { userId: "u1" });
    expect(detail).toEqual({
      key: "checkout",
      value: true,
      variation: "on",
      reason: "rule_match",
      ruleId: "r1",
    });
    client.close();
  });

  it("synthesizes a default result on failure, falling back to client defaults", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof globalThis.fetch;
    const client = createClient({
      key: "k",
      fetch,
      refreshInterval: 0,
      defaults: { theme: "dark" },
    });

    await expect(client.flagDetail("theme")).resolves.toEqual({
      key: "theme",
      value: "dark",
      variation: "default",
      reason: "default",
    });
    await expect(client.flagDetail("other", { default: 1 })).resolves.toEqual({
      key: "other",
      value: 1,
      variation: "default",
      reason: "default",
    });
    await expect(client.flagDetail("unknown")).resolves.toEqual({
      key: "unknown",
      value: null,
      variation: "default",
      reason: "default",
    });
    client.close();
  });
});

// ---------------------------------------------------------------- allFlags

describe("allFlags()", () => {
  it("returns a key → value map and omits the key field from the body", async () => {
    const fetch = mockFetch({
      evaluate: () =>
        evaluateResponse([result("checkout", true), result("theme", "dark")]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await expect(client.allFlags({ userId: "u1" })).resolves.toEqual({
      checkout: true,
      theme: "dark",
    });
    expect(bodyOf(fetch.mock.calls[0]![1])).toEqual({ context: { userId: "u1" } });
    client.close();
  });

  it("returns {} on failure (client defaults when configured)", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof globalThis.fetch;

    const bare = createClient({ key: "k", fetch: failing, refreshInterval: 0 });
    await expect(bare.allFlags()).resolves.toEqual({});
    bare.close();

    const withDefaults = createClient({
      key: "k",
      fetch: failing,
      refreshInterval: 0,
      defaults: { checkout: false },
    });
    await expect(withDefaults.allFlags()).resolves.toEqual({ checkout: false });
    withDefaults.close();
  });
});

// ---------------------------------------------------------- signIn / signOut

describe("signIn / signOut (ambient identity)", () => {
  it("applies the identified user and attributes to flag() without repeating them", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    client.signIn("user-123", { plan: "pro", region: "eu" });
    await client.flag("checkout", { default: false });

    expect(bodyOf(fetch.mock.calls[0]![1])).toEqual({
      key: "checkout",
      context: { userId: "user-123", attributes: { plan: "pro", region: "eu" } },
    });
    client.close();
  });

  it("applies the ambient identity to allFlags()", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    client.signIn("user-123", { plan: "pro" });
    await client.allFlags();

    expect(bodyOf(fetch.mock.calls[0]![1])).toEqual({
      context: { userId: "user-123", attributes: { plan: "pro" } },
    });
    client.close();
  });

  it("lets a per-call userId override, and merges per-call attributes over identity", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    client.signIn("user-123", { plan: "pro", region: "eu" });
    await client.flag("checkout", {
      userId: "override",
      attributes: { region: "us" }, // wins over identity's region
      default: false,
    });

    expect(bodyOf(fetch.mock.calls[0]![1])).toEqual({
      key: "checkout",
      context: { userId: "override", attributes: { plan: "pro", region: "us" } },
    });
    client.close();
  });

  it("signOut() reverts to anonymous evaluation", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    client.signIn("user-123");
    client.signOut();
    await client.flag("checkout", { default: false });

    // No userId/attributes → context omitted entirely from the body.
    expect(bodyOf(fetch.mock.calls[0]![1])).toEqual({ key: "checkout" });
    client.close();
  });

  it("signIn() clears the evaluation cache so flags re-evaluate for the new user", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await client.flag("checkout", { default: false }); // anonymous, cached
    expect(fetch).toHaveBeenCalledTimes(1);

    client.signIn("user-123"); // clears cache
    await client.flag("checkout", { default: false });
    expect(fetch).toHaveBeenCalledTimes(2);

    const secondBody = bodyOf(fetch.mock.calls[1]![1]) as { context?: unknown };
    expect(secondBody.context).toEqual({ userId: "user-123" });
    client.close();
  });

  it("signIn() and signOut() emit 'update' so subscribers re-render", async () => {
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });
    const onUpdate = vi.fn();
    client.on("update", onUpdate);

    client.signIn("user-123");
    client.signOut();
    expect(onUpdate).toHaveBeenCalledTimes(2);

    client.signOut(); // no-op when already anonymous, no extra emission
    expect(onUpdate).toHaveBeenCalledTimes(2);
    client.close();
  });

  it("getUser() reflects the current identity", async () => {
    const fetch = mockFetch({});
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    expect(client.getUser()).toBeNull();

    client.signIn("user-123", { plan: "pro" });
    expect(client.getUser()).toEqual({ userId: "user-123", attributes: { plan: "pro" } });

    client.signOut();
    expect(client.getUser()).toBeNull();
    client.close();
  });

  it("rejects an empty userId via onError and stays anonymous", async () => {
    const onError = vi.fn();
    const fetch = mockFetch({});
    const client = createClient({ key: "k", fetch, refreshInterval: 0, onError });

    client.signIn("");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(client.getUser()).toBeNull();
    client.close();
  });
});

// ---------------------------------------------------------------- polling

describe("snapshot polling", () => {
  it("invalidates the cache and emits 'update' when the snapshot version changes", async () => {
    vi.useFakeTimers();
    const snapshots = [snapshotResponse(1), snapshotResponse(2)];
    const snapshotCalls: (RequestInit | undefined)[] = [];
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
      snapshot: (init) => {
        snapshotCalls.push(init);
        return snapshots.shift() ?? fakeResponse(null, { status: 304 });
      },
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 30_000 });
    const onUpdate = vi.fn();
    client.on("update", onUpdate);

    await client.ready(); // first snapshot (v1) fetched immediately
    expect(snapshotCalls).toHaveLength(1);
    expect(headerOf(snapshotCalls[0], "If-None-Match")).toBeUndefined();

    await vi.advanceTimersByTimeAsync(29_000);
    await client.flag("checkout", { default: false }); // cached at t=29s
    const evaluateCount = () =>
      fetch.mock.calls.filter(([url]) => String(url).endsWith("/v1/evaluate")).length;
    expect(evaluateCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000); // tick at t=30s → snapshot v2
    expect(snapshotCalls).toHaveLength(2);
    expect(headerOf(snapshotCalls[1], "If-None-Match")).toBe('"v1"');
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // Entry was only 1s old (TTL 30s), a re-fetch proves the version change
    // cleared it, not TTL expiry.
    await client.flag("checkout", { default: false });
    expect(evaluateCount()).toBe(2);
    client.close();
  });

  it("keeps the cache and stays silent on 304", async () => {
    vi.useFakeTimers();
    let first = true;
    const snapshotCalls: (RequestInit | undefined)[] = [];
    const fetch = mockFetch({
      evaluate: () => evaluateResponse([result("checkout", true)]),
      snapshot: (init) => {
        snapshotCalls.push(init);
        if (first) {
          first = false;
          return snapshotResponse(1);
        }
        return fakeResponse(null, { status: 304 });
      },
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 30_000 });
    const onUpdate = vi.fn();
    client.on("update", onUpdate);

    await client.ready();
    await vi.advanceTimersByTimeAsync(29_000);
    await client.flag("checkout", { default: false });

    await vi.advanceTimersByTimeAsync(1_000); // tick → 304
    expect(snapshotCalls).toHaveLength(2);
    expect(headerOf(snapshotCalls[1], "If-None-Match")).toBe('"v1"');
    expect(onUpdate).not.toHaveBeenCalled();

    await client.flag("checkout", { default: false }); // still cached
    const evaluateCalls = fetch.mock.calls.filter(([url]) =>
      String(url).endsWith("/v1/evaluate"),
    );
    expect(evaluateCalls).toHaveLength(1);
    client.close();
  });

  it("close() stops polling", async () => {
    vi.useFakeTimers();
    let snapshotCount = 0;
    const fetch = mockFetch({
      snapshot: () => {
        snapshotCount += 1;
        return snapshotResponse(1);
      },
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 30_000 });

    await client.ready();
    expect(snapshotCount).toBe(1);

    client.close();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(snapshotCount).toBe(1);
  });

  it("ready() resolves even when the first snapshot fails, after onError", async () => {
    const onError = vi.fn();
    const fetch = mockFetch({
      snapshot: () => fakeResponse("nope", { status: 500 }),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 30_000, onError });

    await expect(client.ready()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("ready() resolves immediately when polling is disabled", async () => {
    const fetch = mockFetch({});
    const client = createClient({ key: "k", fetch, refreshInterval: 0 });

    await expect(client.ready()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    client.close();
  });

  it("on() returns an unsubscribe function", async () => {
    vi.useFakeTimers();
    const snapshots = [snapshotResponse(1), snapshotResponse(2), snapshotResponse(3)];
    const fetch = mockFetch({
      snapshot: () => snapshots.shift() ?? fakeResponse(null, { status: 304 }),
    });
    const client = createClient({ key: "k", fetch, refreshInterval: 30_000 });
    const onUpdate = vi.fn();
    const off = client.on("update", onUpdate);

    await client.ready();
    await vi.advanceTimersByTimeAsync(30_000); // v2 → update
    expect(onUpdate).toHaveBeenCalledTimes(1);

    off();
    await vi.advanceTimersByTimeAsync(30_000); // v3 → no longer subscribed
    expect(onUpdate).toHaveBeenCalledTimes(1);
    client.close();
  });
});

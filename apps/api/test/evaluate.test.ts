import { describe, expect, it } from "vitest";
import { hashUserId } from "@betterflag/core";
import type { EvaluationEvent, EvaluationResult } from "@betterflag/core";
import {
  AE_MAX_POINTS_PER_INVOCATION,
  AE_ROLLUP_FLAG_KEY,
  aeDualWriteEnabled,
  buildDataPoints,
  buildEvents,
  chunk,
  handleRequest,
  publishEvents,
} from "../src/index";
import {
  AGENT_KEY,
  ENV_SLUG,
  ORG_ID,
  PROJECT_ID,
  SDK_KEY,
  SDK_KEY_SAME_PREFIX,
  SNAPSHOT,
  evaluateRequest,
  fakeCtx,
  fakeDataset,
  fakeQueue,
  keyEntry,
  standardKv,
} from "./helpers";

interface EvaluateResponse {
  version: number;
  results: EvaluationResult[];
}

interface ErrorResponse {
  error: { code: string; message: string };
}

describe("POST /v1/evaluate, auth", () => {
  it("accepts a valid SDK key (hash verified against KV entry)", async () => {
    const kv = await standardKv();
    const queue = fakeQueue();
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { key: "checkout-redesign" } }),
      { CONFIG_KV: kv, EVENTS: queue },
      fakeCtx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as EvaluateResponse;
    expect(body.version).toBe(42);
    expect(body.results).toEqual([
      { key: "checkout-redesign", value: true, variation: "on", reason: "default" },
    ]);
    // Single KV read for the key + single for the snapshot, nothing else.
    expect(kv.reads.map((r) => r.key)).toEqual([
      `key:${SDK_KEY.slice(0, 16)}`,
      `cfg:${PROJECT_ID}:${ENV_SLUG}`,
    ]);
    expect(kv.reads[0]!.options).toEqual({ type: "json", cacheTtl: 60 });
    expect(kv.reads[1]!.options).toEqual({ type: "json", cacheTtl: 60 });
  });

  it("rejects a key whose prefix matches but whose hash does not", async () => {
    const kv = await standardKv();
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY_SAME_PREFIX, body: {} }),
      { CONFIG_KV: kv, EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorResponse).error.code).toBe("invalid_key");
  });

  it("rejects an unknown key (no KV entry)", async () => {
    const kv = await standardKv();
    const res = await handleRequest(
      evaluateRequest({ token: `bf_sdk_${"f".repeat(40)}`, body: {} }),
      { CONFIG_KV: kv, EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a revoked key", async () => {
    const kv = await standardKv({ revoked: true });
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: {} }),
      { CONFIG_KV: kv, EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorResponse).error.code).toBe("invalid_key");
  });

  it("rejects non-sdk keys and missing Authorization", async () => {
    const kv = await standardKv();
    for (const token of [AGENT_KEY, "not-a-key", undefined]) {
      const res = await handleRequest(
        evaluateRequest({ ...(token !== undefined ? { token } : {}), body: {} }),
        { CONFIG_KV: kv, EVENTS: fakeQueue() },
        fakeCtx(),
      );
      expect(res.status).toBe(401);
    }
  });
});

describe("POST /v1/evaluate, key selection", () => {
  it("evaluates multiple named keys, including a missing one as not_found", async () => {
    const res = await handleRequest(
      evaluateRequest({
        token: SDK_KEY,
        body: { keys: ["checkout-redesign", "banner-text", "missing-flag"] },
      }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as EvaluateResponse;
    expect(body.results).toHaveLength(3);
    expect(body.results[0]).toMatchObject({ key: "checkout-redesign", value: true });
    expect(body.results[1]).toMatchObject({
      key: "banner-text",
      value: "bye",
      variation: "off",
      reason: "disabled",
    });
    expect(body.results[2]).toEqual({
      key: "missing-flag",
      value: null,
      variation: "default",
      reason: "not_found",
    });
  });

  it("evaluates all flags when neither key nor keys is given", async () => {
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: {} }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    const body = (await res.json()) as EvaluateResponse;
    expect(body.version).toBe(42);
    expect(body.results.map((r) => r.key).sort()).toEqual(["banner-text", "checkout-redesign"]);
  });

  it("treats an empty body as all-flags", async () => {
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as EvaluateResponse).results).toHaveLength(2);
  });

  it("rejects key and keys together", async () => {
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { key: "a", keys: ["b"] } }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorResponse).error.code).toBe("invalid_request");
  });
});

describe("POST /v1/evaluate, country fallback from request.cf", () => {
  /** A flag that serves ON only for country=FR, otherwise 0% rollout = off. */
  const geoSnapshot = {
    ...SNAPSHOT,
    flags: {
      "geo-flag": {
        kind: "boolean" as const,
        enabled: true,
        killed: false,
        rolloutPct: 0,
        rules: [
          {
            id: "rule-fr",
            conditions: [{ attribute: "country", op: "eq" as const, value: "FR" }],
            serve: "on" as const,
          },
        ],
        valueOn: true,
        valueOff: false,
        defaultValue: false,
      },
    },
  };

  it("injects cf.country into the context when the SDK sent none", async () => {
    const res = await handleRequest(
      evaluateRequest({
        token: SDK_KEY,
        body: { key: "geo-flag", context: { userId: "u1" } },
        cf: { country: "fr" },
      }),
      { CONFIG_KV: await standardKv(undefined, geoSnapshot), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    const body = (await res.json()) as EvaluateResponse;
    expect(body.results[0]).toMatchObject({ key: "geo-flag", value: true, variation: "on" });
  });

  it("never overrides an explicit context country", async () => {
    const res = await handleRequest(
      evaluateRequest({
        token: SDK_KEY,
        body: { key: "geo-flag", context: { userId: "u1", attributes: { country: "US" } } },
        cf: { country: "fr" },
      }),
      { CONFIG_KV: await standardKv(undefined, geoSnapshot), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    const body = (await res.json()) as EvaluateResponse;
    expect(body.results[0]).toMatchObject({ key: "geo-flag", value: false });
  });

  it("injects nothing when Cloudflare has no country", async () => {
    const res = await handleRequest(
      evaluateRequest({
        token: SDK_KEY,
        body: { key: "geo-flag", context: { userId: "u1" } },
      }),
      { CONFIG_KV: await standardKv(undefined, geoSnapshot), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    const body = (await res.json()) as EvaluateResponse;
    expect(body.results[0]).toMatchObject({ key: "geo-flag", value: false });
  });
});

describe("POST /v1/evaluate, missing snapshot", () => {
  it("returns version 0 and empty results for all-flags", async () => {
    const queue = fakeQueue();
    const ctx = fakeCtx();
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: {} }),
      { CONFIG_KV: await standardKv(undefined, null), EVENTS: queue },
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as EvaluateResponse).toEqual({ version: 0, results: [] });
    await ctx.flush();
    expect(queue.batches).toHaveLength(0);
  });

  it("returns not_found results for named keys (never 500)", async () => {
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { keys: ["a", "b"] } }),
      { CONFIG_KV: await standardKv(undefined, null), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as EvaluateResponse;
    expect(body.version).toBe(0);
    expect(body.results).toEqual([
      { key: "a", value: null, variation: "default", reason: "not_found" },
      { key: "b", value: null, variation: "default", reason: "not_found" },
    ]);
  });
});

describe("POST /v1/evaluate, event emission", () => {
  it("emits one event per result with org/project/env from the key entry", async () => {
    const queue = fakeQueue();
    const ctx = fakeCtx();
    const res = await handleRequest(
      evaluateRequest({
        token: SDK_KEY,
        body: { keys: ["checkout-redesign", "missing-flag"], context: { userId: "user-42" } },
        sdkHeader: "js/0.1.0",
      }),
      { CONFIG_KV: await standardKv(), EVENTS: queue },
      ctx,
    );
    expect(res.status).toBe(200);
    await ctx.flush();

    const events = queue.events();
    expect(events).toHaveLength(2);
    const first = events[0]!;
    expect(first.org_id).toBe(ORG_ID);
    expect(first.project_id).toBe(PROJECT_ID);
    expect(first.env).toBe(ENV_SLUG);
    expect(first.flag_key).toBe("checkout-redesign");
    expect(first.variation).toBe("on");
    expect(first.reason).toBe("default");
    expect(first.actor_kind).toBe("sdk");
    expect(first.sdk).toBe("js/0.1.0");
    expect(first.user_hash).toBe(hashUserId("user-42"));
    expect(Number.isNaN(Date.parse(first.ts))).toBe(false);
    expect(events[1]!.reason).toBe("not_found");
  });

  it("uses user_hash '0' for anonymous contexts and sdk 'unknown' without header", async () => {
    const queue = fakeQueue();
    const ctx = fakeCtx();
    await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { key: "checkout-redesign" } }),
      { CONFIG_KV: await standardKv(), EVENTS: queue },
      ctx,
    );
    await ctx.flush();
    const events = queue.events();
    expect(events).toHaveLength(1);
    expect(events[0]!.user_hash).toBe("0");
    expect(events[0]!.sdk).toBe("unknown");
  });

  it("a failing queue never fails the response", async () => {
    const ctx = fakeCtx();
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { key: "checkout-redesign" } }),
      {
        CONFIG_KV: await standardKv(),
        EVENTS: {
          sendBatch: () => Promise.reject(new Error("queue down")),
        },
      },
      ctx,
    );
    expect(res.status).toBe(200);
    await expect(ctx.flush()).resolves.toBeUndefined();
  });

  it("chunks event batches at 100", async () => {
    const entry = await keyEntry();
    const results: EvaluationResult[] = Array.from({ length: 250 }, (_, i) => ({
      key: `flag-${i}`,
      value: true,
      variation: "on" as const,
      reason: "default" as const,
    }));
    const events: EvaluationEvent[] = buildEvents(entry, results, {}, "unknown", "unknown");
    const queue = fakeQueue();
    await publishEvents(queue, events);
    expect(queue.batches.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe("POST /v1/evaluate, Analytics Engine dual-write (ITR-62)", () => {
  it("writes one detail point per evaluation when enabled, alongside the queue", async () => {
    const queue = fakeQueue();
    const dataset = fakeDataset();
    const ctx = fakeCtx();
    const res = await handleRequest(
      evaluateRequest({
        token: SDK_KEY,
        body: { keys: ["checkout-redesign", "banner-text"], context: { userId: "user-42" } },
        sdkHeader: "js/0.1.0",
        cf: { country: "fr" },
      }),
      {
        CONFIG_KV: await standardKv(),
        EVENTS: queue,
        EVALS: dataset,
        ANALYTICS_AE_ENABLED: "true",
      },
      ctx,
    );
    expect(res.status).toBe(200);
    await ctx.flush();

    // Queue path untouched by the dual-write.
    expect(queue.events()).toHaveLength(2);

    expect(dataset.points).toHaveLength(2);
    const point = dataset.points[0]!;
    expect(point.indexes).toEqual([ORG_ID]);
    expect(point.blobs).toEqual([
      PROJECT_ID,
      ENV_SLUG,
      "checkout-redesign",
      "on",
      "default",
      "sdk",
      "js/0.1.0",
      "FR",
    ]);
    expect(point.doubles).toEqual([Number(hashUserId("user-42")), 1]);
  });

  it("stays silent when the env flag is off or the binding is missing", async () => {
    const dataset = fakeDataset();
    const ctx = fakeCtx();
    // Binding present, flag absent.
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { key: "checkout-redesign" } }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue(), EVALS: dataset },
      ctx,
    );
    expect(res.status).toBe(200);
    await ctx.flush();
    expect(dataset.points).toHaveLength(0);

    // Flag on, binding absent: evaluates fine, nothing to write to.
    const res2 = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { key: "checkout-redesign" } }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue(), ANALYTICS_AE_ENABLED: "true" },
      fakeCtx(),
    );
    expect(res2.status).toBe(200);

    expect(aeDualWriteEnabled({ EVALS: dataset, ANALYTICS_AE_ENABLED: "1" })).toBe(true);
    expect(aeDualWriteEnabled({ EVALS: dataset, ANALYTICS_AE_ENABLED: "false" })).toBe(false);
    expect(aeDualWriteEnabled({ ANALYTICS_AE_ENABLED: "true" })).toBe(false);
  });

  it("a throwing dataset never fails the response or the queue path", async () => {
    const queue = fakeQueue();
    const ctx = fakeCtx();
    const res = await handleRequest(
      evaluateRequest({ token: SDK_KEY, body: { key: "checkout-redesign" } }),
      {
        CONFIG_KV: await standardKv(),
        EVENTS: queue,
        EVALS: {
          writeDataPoint: () => {
            throw new Error("AE down");
          },
        },
        ANALYTICS_AE_ENABLED: "true",
      },
      ctx,
    );
    expect(res.status).toBe(200);
    await ctx.flush();
    expect(queue.events()).toHaveLength(1);
  });

  it("caps at 25 points via a rollup that preserves the exact total count", async () => {
    const entry = await keyEntry();
    const results: EvaluationResult[] = Array.from({ length: 60 }, (_, i) => ({
      key: `flag-${i}`,
      value: true,
      variation: "on" as const,
      reason: "default" as const,
    }));
    const events = buildEvents(entry, results, { userId: "user-42" }, "js/0.1.0", "DE");

    const points = buildDataPoints(events);
    expect(points).toHaveLength(AE_MAX_POINTS_PER_INVOCATION);

    const rollup = points[points.length - 1]!;
    expect(rollup.blobs[2]).toBe(AE_ROLLUP_FLAG_KEY);
    expect(rollup.blobs[3]).toBe("");
    expect(rollup.blobs[4]).toBe("rollup");
    // Request-constant dimensions survive the rollup.
    expect(rollup.indexes).toEqual([ORG_ID]);
    expect(rollup.blobs[7]).toBe("DE");
    expect(rollup.doubles[1]).toBe(60 - (AE_MAX_POINTS_PER_INVOCATION - 1));

    const total = points.reduce((sum, p) => sum + p.doubles[1], 0);
    expect(total).toBe(60);

    // At exactly the limit there is no rollup.
    const exact = buildDataPoints(events.slice(0, AE_MAX_POINTS_PER_INVOCATION));
    expect(exact).toHaveLength(AE_MAX_POINTS_PER_INVOCATION);
    expect(exact.every((p) => p.doubles[1] === 1)).toBe(true);
  });
});

describe("CORS and routing", () => {
  it("answers OPTIONS preflight with full CORS headers", async () => {
    const res = await handleRequest(
      new Request("https://api.betterflag.app/v1/evaluate", { method: "OPTIONS" }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, content-type, x-betterflag-sdk",
    );
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await handleRequest(
      new Request("https://api.betterflag.app/nope", { method: "GET" }),
      { CONFIG_KV: await standardKv(), EVENTS: fakeQueue() },
      fakeCtx(),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(((await res.json()) as ErrorResponse).error.code).toBe("not_found");
  });
});

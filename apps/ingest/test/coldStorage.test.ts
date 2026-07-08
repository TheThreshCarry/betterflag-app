import { describe, expect, it } from "vitest";

import {
  dayOfObjectKey,
  expiredKeysForOrg,
  exportObjectKey,
  exportOrgDay,
  exportTargetDay,
  gzipStream,
  orgsWithEventsOnDay,
  runColdStorageJob,
  shiftedUtcDay,
  utcDay,
  type AnalyticsR2Like,
  type ColdStorageEnv,
} from "../src/coldStorage";

const CH_ENV = {
  CLICKHOUSE_URL: "https://clickhouse.example.com:8443",
  CLICKHOUSE_USER: "ingest",
  CLICKHOUSE_PASSWORD: "secret",
};

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

interface FakeR2 extends AnalyticsR2Like {
  objects: Map<string, ArrayBuffer>;
  deleted: string[];
}

function fakeR2(existingKeys: string[] = []): FakeR2 {
  const objects = new Map<string, ArrayBuffer>(
    existingKeys.map((key) => [key, new ArrayBuffer(0)]),
  );
  const r2: FakeR2 = {
    objects,
    deleted: [],
    head: (key) => Promise.resolve(objects.has(key) ? { key } : null),
    put: (key, value) => {
      objects.set(key, value);
      return Promise.resolve({ key });
    },
    delete: (keys) => {
      for (const key of keys) {
        objects.delete(key);
        r2.deleted.push(key);
      }
      return Promise.resolve();
    },
    list: ({ prefix }) =>
      Promise.resolve({
        objects: [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
        truncated: false,
      }),
  };
  return r2;
}

function ndjsonResponse(lines: string[]): Response {
  return new Response(lines.join("\n"), { status: 200 });
}

// ---------------------------------------------------------------------------
// Keys and dates
// ---------------------------------------------------------------------------

describe("keys and dates", () => {
  it("builds the documented object key", () => {
    expect(exportObjectKey("org-1", "2026-07-01")).toBe("analytics/org-1/2026-07-01.ndjson.gz");
  });

  it("extracts the day back out of a key", () => {
    expect(dayOfObjectKey("analytics/org-1/2026-07-01.ndjson.gz")).toBe("2026-07-01");
    expect(dayOfObjectKey("analytics/org-1/garbage.txt")).toBeNull();
  });

  it("targets the day about to age out of the 7-day hot window", () => {
    // ANALYTICS_HOT_DAYS = 7 → export today − 6.
    expect(exportTargetDay(new Date("2026-07-08T03:10:00Z"))).toBe("2026-07-02");
  });

  it("shifts UTC days across month boundaries", () => {
    expect(utcDay(new Date("2026-07-08T23:59:59Z"))).toBe("2026-07-08");
    expect(shiftedUtcDay(new Date("2026-07-01T00:00:00Z"), -1)).toBe("2026-06-30");
  });
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

describe("orgsWithEventsOnDay", () => {
  it("parses distinct org ids from JSONEachRow", async () => {
    const orgs = await orgsWithEventsOnDay(CH_ENV, "2026-07-02", () =>
      Promise.resolve(ndjsonResponse(['{"org_id":"org-1"}', '{"org_id":"org-2"}'])),
    );
    expect(orgs).toEqual(["org-1", "org-2"]);
  });

  it("throws on a ClickHouse error status", async () => {
    await expect(
      orgsWithEventsOnDay(CH_ENV, "2026-07-02", () =>
        Promise.resolve(new Response("boom", { status: 500 })),
      ),
    ).rejects.toThrow(/ClickHouse query failed: 500/);
  });
});

describe("exportOrgDay", () => {
  const rows = ['{"ts":"2026-07-02 01:02:03.000","org_id":"org-1"}'];

  function env(r2: FakeR2): ColdStorageEnv {
    return {
      ...CH_ENV,
      ANALYTICS_R2: r2,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
  }

  it("writes a gzipped NDJSON object", async () => {
    const r2 = fakeR2();
    const outcome = await exportOrgDay(env(r2), "org-1", "2026-07-02", () =>
      Promise.resolve(ndjsonResponse(rows)),
    );
    expect(outcome).toBe("exported");
    const stored = r2.objects.get("analytics/org-1/2026-07-02.ndjson.gz");
    expect(stored).toBeDefined();
    // Round-trip: gunzip and compare.
    const decompressed = await new Response(
      new Response(stored).body!.pipeThrough(new DecompressionStream("gzip")),
    ).text();
    expect(decompressed).toBe(rows.join("\n"));
  });

  it("skips when the object already exists (idempotent reruns)", async () => {
    const r2 = fakeR2(["analytics/org-1/2026-07-02.ndjson.gz"]);
    const outcome = await exportOrgDay(env(r2), "org-1", "2026-07-02", () => {
      throw new Error("ClickHouse must not be queried on skip");
    });
    expect(outcome).toBe("skipped");
  });
});

describe("gzipStream", () => {
  it("round-trips content", async () => {
    const source = new Response("hello analytics").body!;
    const gzipped = await gzipStream(source);
    const text = await new Response(
      new Response(gzipped).body!.pipeThrough(new DecompressionStream("gzip")),
    ).text();
    expect(text).toBe("hello analytics");
  });
});

// ---------------------------------------------------------------------------
// Retention sweep
// ---------------------------------------------------------------------------

describe("expiredKeysForOrg", () => {
  const now = new Date("2026-07-08T03:10:00Z");

  it("expires only objects strictly older than the plan window", async () => {
    // starter = 30 days → cutoff 2026-06-08.
    const r2 = fakeR2([
      "analytics/org-1/2026-06-07.ndjson.gz", // expired
      "analytics/org-1/2026-06-08.ndjson.gz", // exactly at cutoff, kept
      "analytics/org-1/2026-07-01.ndjson.gz", // kept
      "analytics/org-2/2026-01-01.ndjson.gz", // other org, ignored
    ]);
    const expired = await expiredKeysForOrg(r2, "org-1", "starter", now);
    expect(expired).toEqual(["analytics/org-1/2026-06-07.ndjson.gz"]);
  });

  it("scale keeps a year", async () => {
    const r2 = fakeR2([
      "analytics/org-1/2025-07-01.ndjson.gz", // > 365d, expired
      "analytics/org-1/2025-08-01.ndjson.gz", // kept
    ]);
    const expired = await expiredKeysForOrg(r2, "org-1", "scale", now);
    expect(expired).toEqual(["analytics/org-1/2025-07-01.ndjson.gz"]);
  });

  it("ignores malformed keys", async () => {
    const r2 = fakeR2(["analytics/org-1/not-a-day.ndjson.gz"]);
    expect(await expiredKeysForOrg(r2, "org-1", "starter", now)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Full job: per-org failures never block other orgs
// ---------------------------------------------------------------------------

describe("runColdStorageJob", () => {
  it("collects export errors per org and keeps going", async () => {
    const r2 = fakeR2();
    const env: ColdStorageEnv = {
      ...CH_ENV,
      ANALYTICS_R2: r2,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
    let call = 0;
    const report = await runColdStorageJob(
      env,
      new Date("2026-07-08T03:10:00Z"),
      () => {
        call += 1;
        // 1: DISTINCT org_id, 2: org-1 rows (fails), 3: org-2 rows (succeeds).
        if (call === 1) {
          return Promise.resolve(ndjsonResponse(['{"org_id":"org-1"}', '{"org_id":"org-2"}']));
        }
        if (call === 2) return Promise.resolve(new Response("boom", { status: 500 }));
        return Promise.resolve(ndjsonResponse(['{"org_id":"org-2"}']));
      },
      () =>
        Promise.resolve([
          { id: "org-1", plan: "starter" as const },
          { id: "org-2", plan: "scale" as const },
        ]),
    );
    expect(report.day).toBe("2026-07-02");
    expect(report.exported).toBe(1);
    expect(report.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/^export org-1\/2026-07-02/)]),
    );
    expect(r2.objects.has("analytics/org-2/2026-07-02.ndjson.gz")).toBe(true);
    expect(report.deleted).toBe(0);
  });

  it("sweeps expired objects per plan during the job", async () => {
    const r2 = fakeR2([
      "analytics/org-1/2026-06-01.ndjson.gz", // starter (30d) → expired
      "analytics/org-2/2026-06-01.ndjson.gz", // scale (365d) → kept
    ]);
    const env: ColdStorageEnv = {
      ...CH_ENV,
      ANALYTICS_R2: r2,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
    const report = await runColdStorageJob(
      env,
      new Date("2026-07-08T03:10:00Z"),
      // No events on the export day.
      () => Promise.resolve(ndjsonResponse([])),
      () =>
        Promise.resolve([
          { id: "org-1", plan: "starter" as const },
          { id: "org-2", plan: "scale" as const },
        ]),
    );
    expect(report.errors).toEqual([]);
    expect(report.deleted).toBe(1);
    expect(r2.deleted).toEqual(["analytics/org-1/2026-06-01.ndjson.gz"]);
    expect(r2.objects.has("analytics/org-2/2026-06-01.ndjson.gz")).toBe(true);
  });
});

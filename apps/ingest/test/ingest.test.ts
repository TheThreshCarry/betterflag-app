import { describe, expect, it } from "vitest";
import type { EvaluationEvent } from "@betterflag/core";
import {
  buildInsertBody,
  evaluationEventSchema,
  eventToRow,
  groupSyncMessages,
  handleConfigSyncBatch,
  handleEventsBatch,
  joinConfigRows,
  shouldWriteSnapshot,
  toClickHouseDateTime64,
} from "../src/index";
import type {
  ClickHouseEvaluationRow,
  ConfigSyncMessage,
  FlagConfigDbRow,
  IngestEnv,
  MessageBatchLike,
  QueueMessageLike,
} from "../src/index";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

interface FakeMessage extends QueueMessageLike {
  acked: boolean;
  retried: boolean;
}

function fakeMessage(body: unknown, id: string): FakeMessage {
  const message: FakeMessage = {
    id,
    body,
    acked: false,
    retried: false,
    ack() {
      message.acked = true;
    },
    retry() {
      message.retried = true;
    },
  };
  return message;
}

interface FakeBatch extends MessageBatchLike {
  readonly messages: readonly FakeMessage[];
  ackedAll: boolean;
}

function fakeBatch(queue: string, messages: FakeMessage[]): FakeBatch {
  const batch: FakeBatch = {
    queue,
    messages,
    ackedAll: false,
    ackAll() {
      batch.ackedAll = true;
    },
  };
  return batch;
}

const ENV: IngestEnv = {
  CONFIG_KV: {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
  },
  ANALYTICS_R2: {
    head: () => Promise.resolve(null),
    put: () => Promise.resolve(undefined),
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ objects: [], truncated: false }),
  },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  CLICKHOUSE_URL: "https://clickhouse.example.com:8443",
  CLICKHOUSE_USER: "ingest",
  CLICKHOUSE_PASSWORD: "secret",
};

const EVENT: EvaluationEvent = {
  ts: "2026-07-04T12:34:56.789Z",
  org_id: "org-1",
  project_id: "proj-1",
  env: "prod",
  flag_key: "checkout-redesign",
  variation: "on",
  reason: "rollout",
  actor_kind: "sdk",
  sdk: "js/0.1.0",
  user_hash: "12345678901234567890",
  country: "FR",
  region: "Île-de-France",
  city: "Paris",
  lat: 48.86,
  lng: 2.35,
};

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function syncBody(overrides?: Partial<ConfigSyncMessage>): ConfigSyncMessage {
  return {
    type: "sync",
    projectId: UUID_A,
    environmentId: UUID_B,
    envSlug: "prod",
    orgId: UUID_C,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ClickHouse row mapping
// ---------------------------------------------------------------------------

describe("toClickHouseDateTime64", () => {
  it("converts ISO with milliseconds to DateTime64(3) format", () => {
    expect(toClickHouseDateTime64("2026-07-04T12:34:56.789Z")).toBe("2026-07-04 12:34:56.789");
  });

  it("pads missing milliseconds", () => {
    expect(toClickHouseDateTime64("2026-07-04T12:34:56Z")).toBe("2026-07-04 12:34:56.000");
  });

  it("normalizes timezone offsets to UTC", () => {
    expect(toClickHouseDateTime64("2026-07-04T14:34:56.789+02:00")).toBe("2026-07-04 12:34:56.789");
  });

  it("throws on garbage", () => {
    expect(() => toClickHouseDateTime64("not-a-date")).toThrow(/invalid timestamp/);
  });
});

describe("eventToRow", () => {
  it("maps every EvaluationEvent field onto the evaluations columns", () => {
    expect(eventToRow(EVENT)).toEqual({
      ts: "2026-07-04 12:34:56.789",
      org_id: "org-1",
      project_id: "proj-1",
      env: "prod",
      flag_key: "checkout-redesign",
      variation: "on",
      reason: "rollout",
      actor_kind: "sdk",
      sdk: "js/0.1.0",
      user_hash: "12345678901234567890",
      country: "FR",
      region: "Île-de-France",
      city: "Paris",
      lat: 48.86,
      lng: 2.35,
    });
  });

  it("maps null region/city to empty string for ClickHouse", () => {
    expect(eventToRow({ ...EVENT, region: null, city: null })).toMatchObject({
      region: "",
      city: "",
    });
  });
});

describe("evaluationEventSchema", () => {
  it("accepts a well-formed event", () => {
    expect(evaluationEventSchema.safeParse(EVENT).success).toBe(true);
  });

  it("defaults a missing country to 'unknown' (pre-country in-flight messages)", () => {
    const { country: _drop, ...legacy } = EVENT;
    const parsed = evaluationEventSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.country).toBe("unknown");
  });

  it("defaults missing region/city/lat/lng to null (pre-geo in-flight messages)", () => {
    const { region: _r, city: _c, lat: _a, lng: _b, ...legacy } = EVENT;
    const parsed = evaluationEventSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.region).toBeNull();
      expect(parsed.data.city).toBeNull();
      expect(parsed.data.lat).toBeNull();
      expect(parsed.data.lng).toBeNull();
    }
  });

  it.each([
    ["bad actor_kind", { ...EVENT, actor_kind: "robot" }],
    ["non-decimal user_hash", { ...EVENT, user_hash: "0xdead" }],
    ["unparseable ts", { ...EVENT, ts: "yesterday" }],
    ["missing field", (({ flag_key: _drop, ...rest }) => rest)(EVENT)],
    ["not an object", "nope"],
  ])("rejects %s", (_label, value) => {
    expect(evaluationEventSchema.safeParse(value).success).toBe(false);
  });
});

describe("buildInsertBody", () => {
  it("produces one JSON object per line", () => {
    const rows = [eventToRow(EVENT), eventToRow({ ...EVENT, flag_key: "other" })];
    const body = buildInsertBody(rows);
    const lines = body.split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toEqual(rows[0]);
    expect(JSON.parse(lines[1]!)).toEqual(rows[1]);
  });
});

describe("handleEventsBatch", () => {
  it("inserts valid rows, acks invalid ones individually, then acks the batch", async () => {
    const good = fakeMessage(EVENT, "m1");
    const bad = fakeMessage({ nope: true }, "m2");
    const batch = fakeBatch("betterflag-events", [good, bad]);

    const requests: { url: string; auth: string | null; body: string }[] = [];
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        auth: new Headers(init?.headers).get("Authorization"),
        body: String(init?.body),
      });
      return new Response("", { status: 200 });
    }) as typeof fetch;

    await handleEventsBatch(batch, ENV, fetchFn);

    expect(bad.acked).toBe(true);
    expect(batch.ackedAll).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe(
      `${ENV.CLICKHOUSE_URL}/?query=${encodeURIComponent("INSERT INTO evaluations FORMAT JSONEachRow")}`,
    );
    expect(requests[0]!.auth).toBe(`Basic ${btoa("ingest:secret")}`);
    const lines = requests[0]!.body.split("\n");
    expect(lines).toHaveLength(1);
    expect((JSON.parse(lines[0]!) as ClickHouseEvaluationRow).flag_key).toBe("checkout-redesign");
  });

  it("throws on a non-2xx ClickHouse response so the batch retries", async () => {
    const batch = fakeBatch("betterflag-events", [fakeMessage(EVENT, "m1")]);
    const fetchFn = (async () => new Response("boom", { status: 500 })) as typeof fetch;

    await expect(handleEventsBatch(batch, ENV, fetchFn)).rejects.toThrow(
      /ClickHouse insert failed: 500/,
    );
    expect(batch.ackedAll).toBe(false);
  });

  it("skips the insert entirely when no message is valid", async () => {
    const bad = fakeMessage("garbage", "m1");
    const batch = fakeBatch("betterflag-events", [bad]);
    const fetchFn = (async () => {
      throw new Error("must not be called");
    }) as typeof fetch;

    await handleEventsBatch(batch, ENV, fetchFn);
    expect(bad.acked).toBe(true);
    expect(batch.ackedAll).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Config sync
// ---------------------------------------------------------------------------

describe("groupSyncMessages", () => {
  it("dedupes by projectId+envSlug and keeps every original message", () => {
    const m1 = fakeMessage(syncBody(), "m1");
    const m2 = fakeMessage(syncBody(), "m2"); // duplicate target
    const m3 = fakeMessage(syncBody({ envSlug: "staging" }), "m3");
    const invalid = fakeMessage({ type: "sync", projectId: "not-a-uuid" }, "m4");

    const dropped: string[] = [];
    const groups = groupSyncMessages(
      [m1, m2, m3, invalid],
      (m) => m.body,
      (m) => dropped.push(m.id),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]!.target.envSlug).toBe("prod");
    expect(groups[0]!.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(groups[1]!.target.envSlug).toBe("staging");
    expect(groups[1]!.messages.map((m) => m.id)).toEqual(["m3"]);
    expect(dropped).toEqual(["m4"]);
  });

  it("treats the same project in different environments as distinct targets", () => {
    const groups = groupSyncMessages(
      [fakeMessage(syncBody({ envSlug: "dev" }), "a"), fakeMessage(syncBody({ envSlug: "prod" }), "b")],
      (m) => m.body,
      () => undefined,
    );
    expect(groups.map((g) => g.target.envSlug)).toEqual(["dev", "prod"]);
  });
});

describe("shouldWriteSnapshot (version-skip / redelivery protection)", () => {
  it("writes when there is no existing snapshot", () => {
    expect(shouldWriteSnapshot(null, 1000)).toBe(true);
    expect(shouldWriteSnapshot(undefined, 1000)).toBe(true);
  });

  it("writes over an older or equal existing version", () => {
    expect(shouldWriteSnapshot({ version: 999 }, 1000)).toBe(true);
    expect(shouldWriteSnapshot({ version: 1000 }, 1000)).toBe(true);
  });

  it("skips when the existing snapshot is newer", () => {
    expect(shouldWriteSnapshot({ version: 1001 }, 1000)).toBe(false);
  });

  it("writes over a corrupt existing entry", () => {
    expect(shouldWriteSnapshot({ nope: true }, 1000)).toBe(true);
    expect(shouldWriteSnapshot("garbage", 1000)).toBe(true);
  });
});

describe("joinConfigRows", () => {
  const config = (flag_id: string, overrides?: Partial<FlagConfigDbRow>): FlagConfigDbRow => ({
    flag_id,
    enabled: true,
    killed: false,
    rollout_pct: 50,
    rules: null,
    value_on: true,
    value_off: false,
    version: 3,
    ...overrides,
  });

  it("maps flag_id to flag_key", () => {
    const rows = joinConfigRows(
      [
        { id: "f1", key: "checkout-redesign" },
        { id: "f2", key: "banner-text" },
      ],
      [config("f1"), config("f2", { enabled: false, version: 7 })],
    );
    expect(rows).toEqual([
      {
        flag_key: "checkout-redesign",
        enabled: true,
        killed: false,
        rollout_pct: 50,
        rules: null,
        value_on: true,
        value_off: false,
        version: 3,
      },
      {
        flag_key: "banner-text",
        enabled: false,
        killed: false,
        rollout_pct: 50,
        rules: null,
        value_on: true,
        value_off: false,
        version: 7,
      },
    ]);
  });

  it("drops configs whose flag is unknown (e.g. archived)", () => {
    const rows = joinConfigRows([{ id: "f1", key: "known" }], [config("f1"), config("ghost")]);
    expect(rows.map((r) => r.flag_key)).toEqual(["known"]);
  });
});

describe("handleConfigSyncBatch", () => {
  it("syncs each unique target once and acks all its messages", async () => {
    const m1 = fakeMessage(syncBody(), "m1");
    const m2 = fakeMessage(syncBody(), "m2");
    const m3 = fakeMessage(syncBody({ envSlug: "staging" }), "m3");
    const batch = fakeBatch("betterflag-config-sync", [m1, m2, m3]);

    const synced: string[] = [];
    await handleConfigSyncBatch(batch, ENV, async (target) => {
      synced.push(`${target.projectId}:${target.envSlug}`);
    });

    expect(synced).toEqual([`${UUID_A}:prod`, `${UUID_A}:staging`]);
    expect([m1.acked, m2.acked, m3.acked]).toEqual([true, true, true]);
    expect([m1.retried, m2.retried, m3.retried]).toEqual([false, false, false]);
  });

  it("retries every message of a failing target, acks the rest", async () => {
    const failing = fakeMessage(syncBody(), "m1");
    const failingDup = fakeMessage(syncBody(), "m2");
    const healthy = fakeMessage(syncBody({ envSlug: "staging" }), "m3");
    const batch = fakeBatch("betterflag-config-sync", [failing, failingDup, healthy]);

    await handleConfigSyncBatch(batch, ENV, async (target) => {
      if (target.envSlug === "prod") throw new Error("supabase down");
    });

    expect([failing.retried, failingDup.retried]).toEqual([true, true]);
    expect([failing.acked, failingDup.acked]).toEqual([false, false]);
    expect(healthy.acked).toBe(true);
    expect(healthy.retried).toBe(false);
  });

  it("acks invalid messages without syncing anything", async () => {
    const invalid = fakeMessage({ type: "sync" }, "m1");
    const batch = fakeBatch("betterflag-config-sync", [invalid]);

    let calls = 0;
    await handleConfigSyncBatch(batch, ENV, async () => {
      calls += 1;
    });

    expect(calls).toBe(0);
    expect(invalid.acked).toBe(true);
    expect(invalid.retried).toBe(false);
  });
});

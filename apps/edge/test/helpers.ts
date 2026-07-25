import { sdkKeyKvKey, sha256Hex, snapshotKvKey } from "@shipos/core";
import type { EvaluationEvent, ProjectSnapshot, SdkKeyKvEntry } from "@shipos/core";
import type { ConfigKvLike, EvalsDatasetLike, EventsQueueLike, WaitUntilLike } from "../src/index";

/** A well-formed SDK key: sos_sdk_ + 40 lowercase hex chars. */
export const SDK_KEY = `sos_sdk_${"a".repeat(40)}`;
/** Same 16-char prefix as SDK_KEY, different secret, hash must NOT match. */
export const SDK_KEY_SAME_PREFIX = `sos_sdk_${"a".repeat(8)}${"b".repeat(32)}`;
/** Valid format but agent kind, must be rejected by the edge. */
export const AGENT_KEY = `sos_agt_${"c".repeat(40)}`;

export const ORG_ID = "org-11111111";
export const PROJECT_ID = "proj-22222222";
export const ENV_SLUG = "prod";

export async function keyEntry(overrides?: Partial<SdkKeyKvEntry>): Promise<SdkKeyKvEntry> {
  return {
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    envSlug: ENV_SLUG,
    hash: await sha256Hex(SDK_KEY),
    revoked: false,
    ...overrides,
  };
}

export const SNAPSHOT: ProjectSnapshot = {
  version: 42,
  projectId: PROJECT_ID,
  environment: ENV_SLUG,
  generatedAt: "2026-07-04T00:00:00.000Z",
  flags: {
    "checkout-redesign": {
      kind: "boolean",
      enabled: true,
      killed: false,
      rolloutPct: 100,
      rules: [],
      valueOn: true,
      valueOff: false,
      defaultValue: false,
    },
    "banner-text": {
      kind: "string",
      enabled: false,
      killed: false,
      rolloutPct: 0,
      rules: [],
      valueOn: "hello",
      valueOff: "bye",
      defaultValue: "bye",
    },
  },
};

export interface FakeKv extends ConfigKvLike {
  reads: { key: string; options: { type: "json"; cacheTtl?: number } }[];
}

export function fakeKv(store: Record<string, unknown>): FakeKv {
  const reads: FakeKv["reads"] = [];
  return {
    reads,
    async get(key, options) {
      reads.push({ key, options });
      return key in store ? store[key] : null;
    },
  };
}

/** KV pre-populated with a valid key entry and the standard snapshot. */
export async function standardKv(
  overrides?: Partial<SdkKeyKvEntry>,
  snapshot: ProjectSnapshot | null = SNAPSHOT,
): Promise<FakeKv> {
  const store: Record<string, unknown> = {
    [sdkKeyKvKey(SDK_KEY.slice(0, 16))]: await keyEntry(overrides),
  };
  if (snapshot !== null) store[snapshotKvKey(PROJECT_ID, ENV_SLUG)] = snapshot;
  return fakeKv(store);
}

export interface FakeQueue extends EventsQueueLike {
  batches: { body: EvaluationEvent }[][];
  events(): EvaluationEvent[];
}

export function fakeQueue(): FakeQueue {
  const batches: { body: EvaluationEvent }[][] = [];
  return {
    batches,
    events: () => batches.flat().map((m) => m.body),
    async sendBatch(messages) {
      batches.push([...messages]);
    },
  };
}

export interface FakeDataset extends EvalsDatasetLike {
  points: { indexes?: string[]; blobs?: string[]; doubles?: number[] }[];
}

export function fakeDataset(): FakeDataset {
  const points: FakeDataset["points"] = [];
  return {
    points,
    writeDataPoint(point) {
      points.push(point);
    },
  };
}

export interface FakeCtx extends WaitUntilLike {
  flush(): Promise<void>;
}

export function fakeCtx(): FakeCtx {
  const pending: Promise<unknown>[] = [];
  return {
    waitUntil(promise) {
      pending.push(promise);
    },
    async flush() {
      await Promise.all(pending);
    },
  };
}

export function evaluateRequest(input: {
  token?: string;
  body?: unknown;
  sdkHeader?: string;
  /** Simulates Cloudflare's request.cf metadata (e.g. { country: "FR" }). */
  cf?: {
    country?: string;
    city?: string;
    latitude?: string;
    longitude?: string;
  };
}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.token !== undefined) headers["Authorization"] = `Bearer ${input.token}`;
  if (input.sdkHeader !== undefined) headers["X-ShipOS-SDK"] = input.sdkHeader;
  const request = new Request("https://edge.shipos.app/v1/evaluate", {
    method: "POST",
    headers,
    body: input.body === undefined ? null : JSON.stringify(input.body),
  });
  if (input.cf !== undefined) {
    Object.defineProperty(request, "cf", { value: input.cf });
  }
  return request;
}

export function snapshotRequest(input: { token?: string; ifNoneMatch?: string }): Request {
  const headers: Record<string, string> = {};
  if (input.token !== undefined) headers["Authorization"] = `Bearer ${input.token}`;
  if (input.ifNoneMatch !== undefined) headers["If-None-Match"] = input.ifNoneMatch;
  return new Request("https://edge.shipos.app/v1/snapshot", { method: "GET", headers });
}

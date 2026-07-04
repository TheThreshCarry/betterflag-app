/**
 * ShipOS ingest worker — queue consumers for the data plane.
 *
 * - `shipos-events`      → batch INSERT into ClickHouse (`evaluations` table,
 *                          JSONEachRow). Non-2xx throws so the batch retries
 *                          (max_retries 5, DLQ shipos-events-dlq).
 * - `shipos-config-sync` → rebuild the (project, environment) KV snapshot from
 *                          Supabase via `buildSnapshot()` from @shipos/core.
 *                          Per-message ack/retry; version read-then-skip
 *                          protects against queue redelivery.
 *
 * See docs/CONTRACTS.md for message formats and KV keys.
 */
import { createClient } from "@supabase/supabase-js";
import { buildSnapshot, flagKindSchema, jsonValueSchema, snapshotKvKey } from "@shipos/core";
import type { EvaluationEvent, FlagConfigRowLike, FlagRowLike } from "@shipos/core";
import type { FlagConfigRow, FlagRow } from "@shipos/db";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Environment (structural types so tests can pass plain fakes — no miniflare)
// ---------------------------------------------------------------------------

/** The slice of a KVNamespace this worker uses. */
export interface SnapshotKvLike {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

export interface IngestEnv {
  CONFIG_KV: SnapshotKvLike;
  SUPABASE_URL: string;
  /** Secret — `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Secret — e.g. https://<id>.clickhouse.cloud:8443 */
  CLICKHOUSE_URL: string;
  CLICKHOUSE_USER: string;
  CLICKHOUSE_PASSWORD: string;
}

/** The slice of a queue Message this worker uses. */
export interface QueueMessageLike<Body = unknown> {
  readonly id: string;
  readonly body: Body;
  ack(): void;
  retry(): void;
}

/** The slice of a MessageBatch this worker uses. */
export interface MessageBatchLike {
  readonly queue: string;
  readonly messages: readonly QueueMessageLike[];
  ackAll(): void;
}

// ---------------------------------------------------------------------------
// shipos-events → ClickHouse
// ---------------------------------------------------------------------------

/** Zod mirror of `EvaluationEvent` from @shipos/core — the queue boundary. */
export const evaluationEventSchema = z.object({
  ts: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "ts must be an ISO timestamp"),
  org_id: z.string().min(1),
  project_id: z.string().min(1),
  env: z.string().min(1),
  flag_key: z.string().min(1),
  variation: z.string(),
  reason: z.string(),
  actor_kind: z.enum(["sdk", "agent", "api"]),
  sdk: z.string(),
  user_hash: z.string().regex(/^\d+$/, "user_hash must be a decimal string"),
}) satisfies z.ZodType<EvaluationEvent>;

/** One JSONEachRow line for the `evaluations` table (see clickhouse/schema.sql). */
export interface ClickHouseEvaluationRow {
  /** DateTime64(3) — "YYYY-MM-DD HH:MM:SS.mmm" (UTC). */
  ts: string;
  org_id: string;
  project_id: string;
  env: string;
  flag_key: string;
  variation: string;
  reason: string;
  actor_kind: string;
  sdk: string;
  /** UInt64 — decimal string is accepted by JSONEachRow. */
  user_hash: string;
}

/** ISO 8601 → ClickHouse DateTime64(3) string, always UTC. */
export function toClickHouseDateTime64(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`invalid timestamp: ${iso}`);
  // "2026-07-04T12:34:56.789Z" → "2026-07-04 12:34:56.789"
  return new Date(ms).toISOString().slice(0, -1).replace("T", " ");
}

export function eventToRow(event: EvaluationEvent): ClickHouseEvaluationRow {
  return {
    ts: toClickHouseDateTime64(event.ts),
    org_id: event.org_id,
    project_id: event.project_id,
    env: event.env,
    flag_key: event.flag_key,
    variation: event.variation,
    reason: event.reason,
    actor_kind: event.actor_kind,
    sdk: event.sdk,
    user_hash: event.user_hash,
  };
}

export function buildInsertBody(rows: readonly ClickHouseEvaluationRow[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

export async function insertEvaluations(
  rows: readonly ClickHouseEvaluationRow[],
  env: Pick<IngestEnv, "CLICKHOUSE_URL" | "CLICKHOUSE_USER" | "CLICKHOUSE_PASSWORD">,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (rows.length === 0) return;
  const query = encodeURIComponent("INSERT INTO evaluations FORMAT JSONEachRow");
  const response = await fetchFn(`${env.CLICKHOUSE_URL}/?query=${query}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.CLICKHOUSE_USER}:${env.CLICKHOUSE_PASSWORD}`)}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: buildInsertBody(rows),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ClickHouse insert failed: ${response.status} ${detail.slice(0, 500)}`);
  }
}

export async function handleEventsBatch(
  batch: MessageBatchLike,
  env: IngestEnv,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const rows: ClickHouseEvaluationRow[] = [];
  for (const message of batch.messages) {
    const parsed = evaluationEventSchema.safeParse(message.body);
    if (!parsed.success) {
      console.error(
        `shipos-events: dropping invalid message ${message.id}: ${parsed.error.message}`,
      );
      message.ack();
      continue;
    }
    rows.push(eventToRow(parsed.data));
  }

  // Throws on non-2xx → the (unacked) batch is redelivered, then DLQ'd.
  await insertEvaluations(rows, env, fetchFn);
  batch.ackAll();
}

// ---------------------------------------------------------------------------
// shipos-config-sync → KV snapshot rebuild
// ---------------------------------------------------------------------------

/** Queue message from the control plane — see CONTRACTS.md "Queues". */
export const configSyncMessageSchema = z.object({
  type: z.literal("sync"),
  projectId: z.uuid(),
  environmentId: z.uuid(),
  envSlug: z.string().min(1),
  orgId: z.uuid(),
});

export type ConfigSyncMessage = z.infer<typeof configSyncMessageSchema>;

export interface SyncGroup<M> {
  target: ConfigSyncMessage;
  messages: M[];
}

/**
 * Parse + dedupe sync messages by (projectId, envSlug) so one rebuild covers
 * every redelivered/duplicate message in the batch. Invalid messages are
 * reported via `onInvalid` (they can never become valid — ack them).
 */
export function groupSyncMessages<M>(
  messages: readonly M[],
  bodyOf: (message: M) => unknown,
  onInvalid: (message: M, error: string) => void,
): SyncGroup<M>[] {
  const groups = new Map<string, SyncGroup<M>>();
  for (const message of messages) {
    const parsed = configSyncMessageSchema.safeParse(bodyOf(message));
    if (!parsed.success) {
      onInvalid(message, parsed.error.message);
      continue;
    }
    const key = `${parsed.data.projectId}:${parsed.data.envSlug}`;
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.messages.push(message);
    } else {
      groups.set(key, { target: parsed.data, messages: [message] });
    }
  }
  return [...groups.values()];
}

/** Rows as selected from Supabase — validated with zod at the boundary. */
export const flagDbRowSchema = z.object({
  id: z.string(),
  key: z.string(),
  kind: flagKindSchema,
  default_value: jsonValueSchema,
  archived_at: z.string().nullable(),
}) satisfies z.ZodType<Pick<FlagRow, "id" | "key" | "kind" | "default_value" | "archived_at">>;

export type FlagDbRow = z.infer<typeof flagDbRowSchema>;

export const flagConfigDbRowSchema = z.object({
  flag_id: z.string(),
  enabled: z.boolean(),
  killed: z.boolean(),
  rollout_pct: z.number(),
  rules: jsonValueSchema.nullable(),
  value_on: jsonValueSchema.nullable(),
  value_off: jsonValueSchema.nullable(),
  version: z.number(),
}) satisfies z.ZodType<
  Pick<
    FlagConfigRow,
    "flag_id" | "enabled" | "killed" | "rollout_pct" | "rules" | "value_on" | "value_off" | "version"
  >
>;

export type FlagConfigDbRow = z.infer<typeof flagConfigDbRowSchema>;

/** Join flag_configs to their flag keys; configs for unknown flags are dropped. */
export function joinConfigRows(
  flags: readonly Pick<FlagDbRow, "id" | "key">[],
  configs: readonly FlagConfigDbRow[],
): FlagConfigRowLike[] {
  const keyByFlagId = new Map(flags.map((flag) => [flag.id, flag.key]));
  const rows: FlagConfigRowLike[] = [];
  for (const config of configs) {
    const flagKey = keyByFlagId.get(config.flag_id);
    if (flagKey === undefined) continue;
    rows.push({
      flag_key: flagKey,
      enabled: config.enabled,
      killed: config.killed,
      rollout_pct: config.rollout_pct,
      rules: config.rules,
      value_on: config.value_on,
      value_off: config.value_off,
      version: config.version,
    });
  }
  return rows;
}

const existingVersionSchema = z.object({ version: z.number() });

/**
 * Queue redelivery protection (CONTRACTS.md "KV snapshots"): skip the write
 * when the existing entry has a NEWER version. Missing or corrupt entries are
 * always overwritten.
 */
export function shouldWriteSnapshot(existing: unknown, newVersion: number): boolean {
  if (existing === null || existing === undefined) return true;
  const parsed = existingVersionSchema.safeParse(existing);
  if (!parsed.success) return true;
  return parsed.data.version <= newVersion;
}

/** Rebuild and publish the KV snapshot for one (project, environment). */
export async function syncEnvironment(target: ConfigSyncMessage, env: IngestEnv): Promise<void> {
  // Per-invocation client — Workers must not reuse global I/O across events.
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, init) },
  });

  const flagsResult = await supabase
    .from("flags")
    .select("id,key,kind,default_value,archived_at")
    .eq("project_id", target.projectId)
    .is("archived_at", null);
  if (flagsResult.error) {
    throw new Error(`flags query failed: ${flagsResult.error.message}`);
  }
  const flags: FlagDbRow[] = z.array(flagDbRowSchema).parse(flagsResult.data);

  let configs: FlagConfigDbRow[] = [];
  if (flags.length > 0) {
    const configsResult = await supabase
      .from("flag_configs")
      .select("flag_id,enabled,killed,rollout_pct,rules,value_on,value_off,version")
      .eq("environment_id", target.environmentId)
      .in(
        "flag_id",
        flags.map((flag) => flag.id),
      );
    if (configsResult.error) {
      throw new Error(`flag_configs query failed: ${configsResult.error.message}`);
    }
    configs = z.array(flagConfigDbRowSchema).parse(configsResult.data);
  }

  const flagRows: FlagRowLike[] = flags.map((flag) => ({
    key: flag.key,
    kind: flag.kind,
    default_value: flag.default_value,
    archived_at: flag.archived_at,
  }));

  const { snapshot, invalidRules } = buildSnapshot({
    projectId: target.projectId,
    environment: target.envSlug,
    version: Date.now(),
    generatedAt: new Date().toISOString(),
    flags: flagRows,
    configs: joinConfigRows(flags, configs),
  });
  for (const invalid of invalidRules) {
    console.error(
      `shipos-config-sync: dropped invalid rules for flag "${invalid.flagKey}" ` +
        `(${target.projectId}/${target.envSlug}): ${invalid.error}`,
    );
  }

  const kvKey = snapshotKvKey(target.projectId, target.envSlug);
  const existing = await env.CONFIG_KV.get(kvKey, { type: "json" });
  if (!shouldWriteSnapshot(existing, snapshot.version)) {
    console.log(
      `shipos-config-sync: skipping stale snapshot v${snapshot.version} for ${kvKey} ` +
        `(existing is newer)`,
    );
    return;
  }
  await env.CONFIG_KV.put(kvKey, JSON.stringify(snapshot));
}

export async function handleConfigSyncBatch(
  batch: MessageBatchLike,
  env: IngestEnv,
  syncFn: (target: ConfigSyncMessage, env: IngestEnv) => Promise<void> = syncEnvironment,
): Promise<void> {
  const groups = groupSyncMessages(
    batch.messages,
    (message) => message.body,
    (message, error) => {
      console.error(`shipos-config-sync: dropping invalid message ${message.id}: ${error}`);
      message.ack();
    },
  );

  for (const group of groups) {
    try {
      await syncFn(group.target, env);
      for (const message of group.messages) message.ack();
    } catch (error) {
      console.error(
        `shipos-config-sync: sync failed for ${group.target.projectId}/${group.target.envSlug}`,
        error,
      );
      for (const message of group.messages) message.retry();
    }
  }
}

// ---------------------------------------------------------------------------
// Worker entry points
// ---------------------------------------------------------------------------

const handler = {
  /** Trivial health endpoint — this worker's real interface is the queues. */
  async fetch(): Promise<Response> {
    return new Response("ok", { status: 200 });
  },

  async queue(batch, env): Promise<void> {
    switch (batch.queue) {
      case "shipos-events":
        await handleEventsBatch(batch, env);
        return;
      case "shipos-config-sync":
        await handleConfigSyncBatch(batch, env);
        return;
      default:
        console.error(`ingest: message batch from unknown queue "${batch.queue}" — acking`);
        batch.ackAll();
    }
  },
} satisfies ExportedHandler<IngestEnv>;

export default handler;

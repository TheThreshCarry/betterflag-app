/**
 * Betterflag ingest worker, queue consumers for the data plane.
 *
 * - `betterflag-events`      → batch INSERT into ClickHouse (`evaluations` table,
 *                          JSONEachRow). Non-2xx throws so the batch retries
 *                          (max_retries 5, DLQ betterflag-events-dlq).
 * - `betterflag-config-sync` → rebuild the (project, environment) KV snapshot from
 *                          Supabase via `buildSnapshot()` from @betterflag/core.
 *                          Per-message ack/retry; version read-then-skip
 *                          protects against queue redelivery.
 * - daily cron           → analytics storage tiering: export the day aging
 *                          out of ClickHouse's 7-day hot TTL to R2, delete
 *                          cold objects past the org's plan retention. See
 *                          src/coldStorage.ts.
 *
 * See docs/CONTRACTS.md for message formats, KV keys and R2 objects.
 */
import { createClient } from "@supabase/supabase-js";
import { buildSnapshot, flagKindSchema, jsonValueSchema, snapshotKvKey } from "@betterflag/core";
import type { EvaluationEvent, FlagConfigRowLike, FlagRowLike } from "@betterflag/core";
import type { FlagConfigRow, FlagRow } from "@betterflag/db";
import { formatRelease, readObservability, attachWorkerTracing, type Observability } from "@betterflag/observability";
import { runColdStorageJob, type AnalyticsR2Like } from "./coldStorage";
import { VERSION } from "./version.gen";
import { z } from "zod";

/** Human-readable one-liner for an unknown thrown value. */
function errText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// ---------------------------------------------------------------------------
// Environment (structural types so tests can pass plain fakes, no miniflare)
// ---------------------------------------------------------------------------

/** The slice of a KVNamespace this worker uses. */
export interface SnapshotKvLike {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

export interface IngestEnv {
  CONFIG_KV: SnapshotKvLike;
  /** Cold storage for raw analytics (bucket `betterflag-analytics-cold`). */
  ANALYTICS_R2: AnalyticsR2Like;
  SUPABASE_URL: string;
  /** Secret, `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Secret, e.g. https://<id>.clickhouse.cloud:8443 */
  CLICKHOUSE_URL: string;
  CLICKHOUSE_USER: string;
  CLICKHOUSE_PASSWORD: string;
  // Observability, optional so unit tests can pass plain fakes; degrades to
  // console-only when unset. Tokens via `wrangler secret put`, endpoints via vars.
  BETTER_STACK_SOURCE_TOKEN?: string;
  BETTER_STACK_LOGS_ENDPOINT?: string;
  /** Better Stack heartbeat URL pinged after a successful cold-storage run. */
  BETTER_STACK_HEARTBEAT_URL?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  BETTERFLAG_ENV?: string;
  /** Deploy-time git commit; appended to VERSION as the release. */
  BETTERFLAG_GIT_SHA?: string;
  /** Fully-formed release override (wins over VERSION + git sha) if set. */
  BETTERFLAG_RELEASE?: string;
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
// betterflag-events → ClickHouse
// ---------------------------------------------------------------------------

/** Zod mirror of `EvaluationEvent` from @betterflag/core, the queue boundary. */
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
  // `.catch` keeps in-flight messages from pre-country / pre-geo edge deploys valid.
  country: z.string().min(1).catch("unknown"),
  region: z.string().nullable().catch(null),
  city: z.string().nullable().catch(null),
  lat: z.number().nullable().catch(null),
  lng: z.number().nullable().catch(null),
}) satisfies z.ZodType<EvaluationEvent>;

/** One JSONEachRow line for the `evaluations` table (see clickhouse/schema.sql). */
export interface ClickHouseEvaluationRow {
  /** DateTime64(3), "YYYY-MM-DD HH:MM:SS.mmm" (UTC). */
  ts: string;
  org_id: string;
  project_id: string;
  env: string;
  flag_key: string;
  variation: string;
  reason: string;
  actor_kind: string;
  sdk: string;
  /** UInt64, decimal string is accepted by JSONEachRow. */
  user_hash: string;
  /** ISO 3166-1 alpha-2 or "unknown". */
  country: string;
  /** Region/state from cf.region; empty string when unavailable. */
  region: string;
  /** City from cf.city; empty string when unavailable. */
  city: string;
  lat: number | null;
  lng: number | null;
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
    country: event.country,
    region: event.region?.trim() ?? "",
    city: event.city?.trim() ?? "",
    lat: event.lat,
    lng: event.lng,
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
  obs?: Observability,
): Promise<void> {
  const log = obs?.logger.child({ queue: batch.queue, batch_size: batch.messages.length });
  const span = obs?.tracer.startSpan("ingest.events", {
    kind: "consumer",
    attributes: { "queue.name": batch.queue, "messaging.batch.message_count": batch.messages.length },
  });

  const rows: ClickHouseEvaluationRow[] = [];
  let dropped = 0;
  for (const message of batch.messages) {
    const parsed = evaluationEventSchema.safeParse(message.body);
    if (!parsed.success) {
      dropped += 1;
      log?.warn("dropping invalid evaluation event", {
        message_id: message.id,
        detail: parsed.error.message,
      });
      message.ack();
      continue;
    }
    rows.push(eventToRow(parsed.data));
  }
  span?.setAttributes({ "events.valid": rows.length, "events.dropped": dropped });

  const insertSpan = span?.startChild("clickhouse.insert", {
    kind: "client",
    attributes: { "db.system": "clickhouse", "db.rows_affected": rows.length },
  });
  try {
    // Throws on non-2xx → the (unacked) batch is redelivered, then DLQ'd.
    await insertEvaluations(rows, env, fetchFn);
  } catch (error) {
    insertSpan?.recordException(error).end();
    span?.setStatus("error").end();
    log?.error("clickhouse insert failed; batch will retry", {
      "event.name": "clickhouse.insert",
      "event.outcome": "error",
      error: errText(error),
      rows: rows.length,
    });
    throw error;
  }
  insertSpan?.end();
  batch.ackAll();
  span?.end();
  log?.info("events batch inserted into ClickHouse", { rows: rows.length, dropped });
}

export async function handleDlqBatch(batch: MessageBatchLike, obs?: Observability): Promise<void> {
  const log = obs?.logger.child({ queue: batch.queue, batch_size: batch.messages.length });
  const span = obs?.tracer.startSpan("ingest.dlq", {
    kind: "consumer",
    attributes: { "queue.name": batch.queue, "messaging.batch.message_count": batch.messages.length },
  });
  for (const message of batch.messages) {
    log?.error("evaluation event landed in DLQ", {
      "event.name": "queue.dlq",
      "event.outcome": "error",
      message_id: message.id,
    });
    message.ack();
  }
  span?.setStatus("error").end();
}

// ---------------------------------------------------------------------------
// betterflag-config-sync → KV snapshot rebuild
// ---------------------------------------------------------------------------

/** Queue message from the control plane, see CONTRACTS.md "Queues". */
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
 * reported via `onInvalid` (they can never become valid, ack them).
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

/** Rows as selected from Supabase, validated with zod at the boundary. */
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
export async function syncEnvironment(
  target: ConfigSyncMessage,
  env: IngestEnv,
  obs?: Observability,
): Promise<void> {
  const log = obs?.logger.child({
    project_id: target.projectId,
    env: target.envSlug,
    environment_id: target.environmentId,
  });
  const span = obs?.tracer.startSpan("ingest.config_sync", {
    kind: "internal",
    attributes: { "betterflag.project_id": target.projectId, "betterflag.env": target.envSlug },
  });

  try {
    // Per-invocation client, Workers must not reuse global I/O across events.
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, init) },
    });

    const flagsSpan = span?.startChild("supabase.select_flags", { kind: "client" });
    const flagsResult = await supabase
      .from("flags")
      .select("id,key,kind,default_value,archived_at")
      .eq("project_id", target.projectId)
      .is("archived_at", null);
    if (flagsResult.error) {
      flagsSpan?.recordException(new Error(flagsResult.error.message)).end();
      throw new Error(`flags query failed: ${flagsResult.error.message}`);
    }
    const flags: FlagDbRow[] = z.array(flagDbRowSchema).parse(flagsResult.data);
    flagsSpan?.setAttribute("flags.count", flags.length).end();

    let configs: FlagConfigDbRow[] = [];
    if (flags.length > 0) {
      const configsSpan = span?.startChild("supabase.select_flag_configs", { kind: "client" });
      const configsResult = await supabase
        .from("flag_configs")
        .select("flag_id,enabled,killed,rollout_pct,rules,value_on,value_off,version")
        .eq("environment_id", target.environmentId)
        .in(
          "flag_id",
          flags.map((flag) => flag.id),
        );
      if (configsResult.error) {
        configsSpan?.recordException(new Error(configsResult.error.message)).end();
        throw new Error(`flag_configs query failed: ${configsResult.error.message}`);
      }
      configs = z.array(flagConfigDbRowSchema).parse(configsResult.data);
      configsSpan?.setAttribute("configs.count", configs.length).end();
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
        `betterflag-config-sync: dropped invalid rules for flag "${invalid.flagKey}" ` +
          `(${target.projectId}/${target.envSlug}): ${invalid.error}`,
      );
      log?.warn("dropped invalid targeting rules while building snapshot", {
        flag_key: invalid.flagKey,
        detail: invalid.error,
      });
    }
    span?.setAttributes({
      "snapshot.version": snapshot.version,
      "snapshot.flags": Object.keys(snapshot.flags).length,
      "snapshot.invalid_rules": invalidRules.length,
    });

    const kvKey = snapshotKvKey(target.projectId, target.envSlug);
    const existing = await env.CONFIG_KV.get(kvKey, { type: "json" });
    if (!shouldWriteSnapshot(existing, snapshot.version)) {
      log?.info("skipped stale snapshot (existing KV entry is newer)", {
        kv_key: kvKey,
        version: snapshot.version,
      });
      span?.setAttribute("snapshot.skipped_stale", true).end();
      return;
    }

    const putSpan = span?.startChild("kv.put_snapshot", { kind: "client" });
    await env.CONFIG_KV.put(kvKey, JSON.stringify(snapshot));
    putSpan?.end();
    span?.end();
    log?.info("published KV snapshot", { kv_key: kvKey, version: snapshot.version, flags: flagRows.length });
  } catch (error) {
    span?.recordException(error).end();
    throw error;
  }
}

export async function handleConfigSyncBatch(
  batch: MessageBatchLike,
  env: IngestEnv,
  syncFn: (target: ConfigSyncMessage, env: IngestEnv, obs?: Observability) => Promise<void> = syncEnvironment,
  obs?: Observability,
): Promise<void> {
  const log = obs?.logger.child({ queue: batch.queue, batch_size: batch.messages.length });
  const groups = groupSyncMessages(
    batch.messages,
    (message) => message.body,
    (message, error) => {
      log?.warn("dropping invalid config-sync message", { message_id: message.id, detail: error });
      message.ack();
    },
  );

  for (const group of groups) {
    try {
      await syncFn(group.target, env, obs);
      for (const message of group.messages) message.ack();
    } catch (error) {
      log?.error("config-sync failed; messages will retry", {
        "event.name": "config.sync",
        "event.outcome": "error",
        project_id: group.target.projectId,
        env: group.target.envSlug,
        messages: group.messages.length,
        error: errText(error),
      });
      for (const message of group.messages) message.retry();
    }
  }
}

// ---------------------------------------------------------------------------
// Worker entry points
// ---------------------------------------------------------------------------

const handler = {
  /** Trivial health endpoint, this worker's real interface is the queues. */
  async fetch(): Promise<Response> {
    return new Response("ok", { status: 200 });
  },

  async queue(batch, env, ctx): Promise<void> {
    attachWorkerTracing(ctx);
    const obs = readObservability(env as unknown as Record<string, unknown>, "betterflag-ingest", {
      environment: env.BETTERFLAG_ENV,
      release: formatRelease({ version: VERSION, gitSha: env.BETTERFLAG_GIT_SHA, override: env.BETTERFLAG_RELEASE }),
      runtime: "worker",
    });
    try {
      switch (batch.queue) {
        case "betterflag-events":
          await handleEventsBatch(batch, env, fetch, obs);
          return;
        case "betterflag-config-sync":
          await handleConfigSyncBatch(batch, env, syncEnvironment, obs);
          return;
        case "betterflag-events-dlq":
          await handleDlqBatch(batch, obs);
          return;
        default:
          obs.logger.warn("message batch from unknown queue, acking", { queue: batch.queue });
          batch.ackAll();
      }
    } finally {
      ctx.waitUntil(obs.flush());
    }
  },

  /** Daily analytics tiering: hot (ClickHouse, 7d) → cold (R2) → deletion. */
  async scheduled(controller, env, ctx): Promise<void> {
    attachWorkerTracing(ctx);
    const obs = readObservability(env as unknown as Record<string, unknown>, "betterflag-ingest", {
      environment: env.BETTERFLAG_ENV,
      release: formatRelease({ version: VERSION, gitSha: env.BETTERFLAG_GIT_SHA, override: env.BETTERFLAG_RELEASE }),
      runtime: "worker",
    });
    const log = obs.logger.child({ cron: controller.cron });
    const span = obs.tracer.startSpan("ingest.cold_storage", { kind: "internal" });
    try {
      const report = await runColdStorageJob(
        env,
        new Date(controller.scheduledTime),
        fetch,
        undefined,
        span,
      );
      span.setAttributes({
        "cold_storage.day": report.day,
        "cold_storage.exported": report.exported,
        "cold_storage.skipped": report.skipped,
        "cold_storage.deleted": report.deleted,
        "cold_storage.errors": report.errors.length,
      });
      const fields = {
        ...report,
        errors: report.errors.slice(0, 10),
        "event.name": "cold_storage",
        "event.outcome": report.errors.length > 0 ? "error" : "ok",
      };
      if (report.errors.length > 0) {
        span.setStatus("error");
        log.error("cold storage job finished with errors", fields);
      } else {
        log.info("cold storage job finished", fields);
        const heartbeatUrl = env.BETTER_STACK_HEARTBEAT_URL;
        if (heartbeatUrl) {
          ctx.waitUntil(
            fetch(heartbeatUrl, { method: "GET" }).catch((error) => {
              log.warn("cold storage heartbeat ping failed", { error: errText(error) });
            }),
          );
        }
      }
    } catch (error) {
      span.recordException(error).setStatus("error");
      log.error("cold storage job crashed", { error: errText(error), "event.outcome": "error" });
      throw error;
    } finally {
      span.end();
      ctx.waitUntil(obs.flush());
    }
  },
} satisfies ExportedHandler<IngestEnv>;

export default handler;

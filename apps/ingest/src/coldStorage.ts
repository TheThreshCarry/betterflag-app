/**
 * Analytics storage tiering (see docs/CONTRACTS.md "Analytics retention").
 *
 * Raw evaluation rows are HOT in ClickHouse for 7 days (table TTL). A daily
 * cron in this worker:
 *
 *   1. EXPORT: copies the finished day that is about to age out of hot
 *      storage (today − 6, fully complete, exported one day before the TTL
 *      fires) to R2 as `analytics/{org_id}/{yyyy-mm-dd}.ndjson.gz`, one
 *      object per org per day. Idempotent: existing objects are skipped, so
 *      redelivered/overlapping cron runs are safe.
 *   2. SWEEP: deletes R2 objects older than the org's plan retention
 *      (ANALYTICS_RETENTION_DAYS from @betterflag/db; plans, not per-org knobs).
 *
 * Aggregate MVs (billing meter, chart series) never leave ClickHouse; this
 * file only tiers the raw event rows.
 */
import { ANALYTICS_HOT_DAYS, ANALYTICS_RETENTION_DAYS, type OrgPlan } from "@betterflag/db";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Structural types (tests pass plain fakes, no miniflare)
// ---------------------------------------------------------------------------

/** The slice of an R2Bucket this job uses. */
export interface AnalyticsR2Like {
  head(key: string): Promise<unknown | null>;
  put(key: string, value: ArrayBuffer): Promise<unknown>;
  delete(keys: string[]): Promise<void>;
  list(options: {
    prefix: string;
    cursor?: string;
  }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
}

export interface ColdStorageEnv {
  ANALYTICS_R2: AnalyticsR2Like;
  CLICKHOUSE_URL: string;
  CLICKHOUSE_USER: string;
  CLICKHOUSE_PASSWORD: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ---------------------------------------------------------------------------
// Keys and dates
// ---------------------------------------------------------------------------

/** R2 object key for one org's raw events for one UTC day. */
export function exportObjectKey(orgId: string, day: string): string {
  return `analytics/${orgId}/${day}.ndjson.gz`;
}

/** "YYYY-MM-DD" (UTC) for a Date. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC day shifted by `days` (negative = past). */
export function shiftedUtcDay(now: Date, days: number): string {
  return utcDay(new Date(now.getTime() + days * 86_400_000));
}

/**
 * The day the daily cron exports: old enough to be complete, young enough to
 * still be fully hot (TTL is ANALYTICS_HOT_DAYS; we export with a day spare).
 */
export function exportTargetDay(now: Date): string {
  return shiftedUtcDay(now, -(ANALYTICS_HOT_DAYS - 1));
}

const objectDayPattern = /\/(\d{4}-\d{2}-\d{2})\.ndjson\.gz$/;

/** Extract the "YYYY-MM-DD" from an export object key, null if malformed. */
export function dayOfObjectKey(key: string): string | null {
  return objectDayPattern.exec(key)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// ClickHouse HTTP helpers (same interface style as the insert path)
// ---------------------------------------------------------------------------

type ChEnv = Pick<ColdStorageEnv, "CLICKHOUSE_URL" | "CLICKHOUSE_USER" | "CLICKHOUSE_PASSWORD">;

async function chFetch(
  env: ChEnv,
  sql: string,
  params: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<Response> {
  const url = new URL(env.CLICKHOUSE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`param_${key}`, value);
  }
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.CLICKHOUSE_USER}:${env.CLICKHOUSE_PASSWORD}`)}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: sql,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ClickHouse query failed: ${response.status} ${detail.slice(0, 500)}`);
  }
  return response;
}

const orgIdRowSchema = z.object({ org_id: z.string().min(1) });

/** Orgs that produced events on `day` (only these get an export object). */
export async function orgsWithEventsOnDay(
  env: ChEnv,
  day: string,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  const response = await chFetch(
    env,
    `SELECT DISTINCT org_id FROM evaluations WHERE toDate(ts) = {day:Date} FORMAT JSONEachRow`,
    { day },
    fetchFn,
  );
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => orgIdRowSchema.parse(JSON.parse(line)).org_id);
}

/** Gzip a ReadableStream into a single ArrayBuffer. */
export async function gzipStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const compressed = stream.pipeThrough(new CompressionStream("gzip"));
  return await new Response(compressed).arrayBuffer();
}

/**
 * Export one org's raw events for one day to R2. Returns "skipped" when the
 * object already exists (idempotency), "exported" otherwise.
 *
 * The gzipped day is buffered in memory before the R2 put; at ~10× NDJSON
 * compression this is fine for current volumes. If a single org/day ever
 * approaches the Worker memory limit, switch to R2 multipart upload.
 */
export async function exportOrgDay(
  env: ColdStorageEnv,
  orgId: string,
  day: string,
  fetchFn: typeof fetch = fetch,
): Promise<"exported" | "skipped"> {
  const key = exportObjectKey(orgId, day);
  if ((await env.ANALYTICS_R2.head(key)) !== null) return "skipped";

  const response = await chFetch(
    env,
    `SELECT * FROM evaluations
     WHERE org_id = {orgId:String} AND toDate(ts) = {day:Date}
     ORDER BY ts ASC
     FORMAT JSONEachRow`,
    { orgId, day },
    fetchFn,
  );
  if (response.body === null) throw new Error("ClickHouse response has no body");
  const gzipped = await gzipStream(response.body);
  await env.ANALYTICS_R2.put(key, gzipped);
  return "exported";
}

// ---------------------------------------------------------------------------
// Retention sweep
// ---------------------------------------------------------------------------

const orgPlanRowSchema = z.object({
  id: z.string().min(1),
  plan: z.enum(["trial", "starter", "launch", "scale"]),
});

export type OrgPlanRow = z.infer<typeof orgPlanRowSchema>;

/** All orgs with their plan, for retention cutoffs. */
export async function listOrgPlans(
  env: Pick<ColdStorageEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">,
): Promise<OrgPlanRow[]> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, init) },
  });
  const result = await supabase.from("orgs").select("id,plan");
  if (result.error) throw new Error(`orgs query failed: ${result.error.message}`);
  return z.array(orgPlanRowSchema).parse(result.data);
}

/** Expired export keys for one org: object day strictly before the cutoff. */
export async function expiredKeysForOrg(
  r2: AnalyticsR2Like,
  orgId: string,
  plan: OrgPlan,
  now: Date,
): Promise<string[]> {
  const cutoff = shiftedUtcDay(now, -ANALYTICS_RETENTION_DAYS[plan]);
  const expired: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await r2.list({ prefix: `analytics/${orgId}/`, cursor });
    for (const object of page.objects) {
      const day = dayOfObjectKey(object.key);
      if (day !== null && day < cutoff) expired.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor !== undefined);
  return expired;
}

// ---------------------------------------------------------------------------
// The daily job
// ---------------------------------------------------------------------------

export interface ColdStorageReport {
  day: string;
  exported: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

/**
 * Run export + sweep. Per-org failures are collected (not thrown) so one bad
 * org never blocks the others; the caller decides whether to alert.
 */
export async function runColdStorageJob(
  env: ColdStorageEnv,
  now: Date = new Date(),
  fetchFn: typeof fetch = fetch,
  listOrgPlansFn: (
    env: Pick<ColdStorageEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">,
  ) => Promise<OrgPlanRow[]> = listOrgPlans,
): Promise<ColdStorageReport> {
  const day = exportTargetDay(now);
  const report: ColdStorageReport = { day, exported: 0, skipped: 0, deleted: 0, errors: [] };

  // 1. Export the day that is about to age out of hot storage.
  let orgIds: string[] = [];
  try {
    orgIds = await orgsWithEventsOnDay(env, day, fetchFn);
  } catch (error) {
    report.errors.push(`list orgs for ${day}: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const orgId of orgIds) {
    try {
      const outcome = await exportOrgDay(env, orgId, day, fetchFn);
      if (outcome === "exported") report.exported += 1;
      else report.skipped += 1;
    } catch (error) {
      report.errors.push(
        `export ${orgId}/${day}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // 2. Sweep cold storage past each org's plan retention.
  try {
    const orgs = await listOrgPlansFn(env);
    for (const org of orgs) {
      try {
        const expired = await expiredKeysForOrg(env.ANALYTICS_R2, org.id, org.plan, now);
        if (expired.length > 0) {
          await env.ANALYTICS_R2.delete(expired);
          report.deleted += expired.length;
        }
      } catch (error) {
        report.errors.push(
          `sweep ${org.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    report.errors.push(`list org plans: ${error instanceof Error ? error.message : String(error)}`);
  }

  return report;
}

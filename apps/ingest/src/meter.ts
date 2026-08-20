/**
 * Hourly Polar metering + SDK-key quota stamp (ITR-187).
 *
 * ClickHouse `evals_per_org_day` is the source of truth. This job:
 *   1. Reads month-to-date evaluations per org.
 *   2. Emits the delta to Polar (`evaluation` events, sum of `evaluations`)
 *      with an hour-scoped external_id so retries do not double-bill.
 *   3. Stamps `plan`, `quota`, `used` onto every SDK key KV entry so the
 *      edge can 429 Starter orgs at 3× included without a DB round trip.
 *
 * Polar is skipped when POLAR_ACCESS_TOKEN is unset or the org has no
 * polar_customer_id (trial, never checked out). KV stamps still run.
 */
import { sdkKeyKvKey, type SdkKeyKvEntry } from "@betterflag/core";
import {
  EVALUATION_EVENT_COUNT_PROPERTY,
  EVALUATION_EVENT_NAME,
  edgeQuotaForPlan,
  type OrgPlan,
} from "@betterflag/db";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const POLAR_METER_CRON = "0 * * * *";
export const METER_KV_PREFIX = "meter:polar:";

export interface MeterKvLike {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

export interface MeterEnv {
  CONFIG_KV: MeterKvLike;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CLICKHOUSE_URL: string;
  CLICKHOUSE_USER: string;
  CLICKHOUSE_PASSWORD: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_SERVER?: string;
}

export interface MeterWatermark {
  month: string;
  reported: number;
  pendingHour: string | null;
  pendingReported: number | null;
}

const watermarkSchema = z.object({
  month: z.string().min(7),
  reported: z.number().int().nonnegative(),
  pendingHour: z.string().nullable(),
  pendingReported: z.number().int().nonnegative().nullable(),
});

const usageRowSchema = z.object({
  org_id: z.string().min(1),
  evaluations: z.union([z.number(), z.string()]),
});

const orgRowSchema = z.object({
  id: z.string().min(1),
  plan: z.enum(["trial", "starter", "launch", "scale"]),
  polar_customer_id: z.string().nullable(),
});

const sdkKeyRowSchema = z.object({
  prefix: z.string().min(1),
  hash: z.string().min(1),
  org_id: z.string().min(1),
  project_id: z.string().min(1),
  env_slug: z.string().min(1),
  revoked_at: z.string().nullable(),
});

export interface MeterOrgUsage {
  orgId: string;
  plan: OrgPlan;
  polarCustomerId: string | null;
  used: number;
}

export interface MeterReport {
  orgs: number;
  ingested: number;
  stamped: number;
  skipped: number;
  errors: string[];
}

export function utcMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export function utcHour(now: Date): string {
  return now.toISOString().slice(0, 13);
}

export function monthStartUtc(now: Date): string {
  return `${utcMonth(now)}-01`;
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function meterKvKey(orgId: string): string {
  return `${METER_KV_PREFIX}${orgId}`;
}

export function polarEventExternalId(orgId: string, hour: string): string {
  return `eval:${orgId}:${hour}`;
}

export function polarApiBase(server: string | undefined): string {
  return server === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
}

export function parseWatermark(raw: unknown, month: string): MeterWatermark {
  const parsed = watermarkSchema.safeParse(raw);
  if (!parsed.success) {
    return { month, reported: 0, pendingHour: null, pendingReported: null };
  }
  const value = parsed.data;
  if (value.month !== month) {
    return { month, reported: 0, pendingHour: null, pendingReported: null };
  }
  return value;
}

export function nextWatermark(input: {
  month: string;
  hour: string;
  used: number;
  current: MeterWatermark;
}): { watermark: MeterWatermark; delta: number; ingestHour: string } {
  const { month, hour, used, current } = input;
  if (current.pendingHour && current.pendingReported !== null) {
    const pendingDelta = Math.max(0, current.pendingReported - current.reported);
    return {
      watermark: current,
      delta: pendingDelta,
      ingestHour: current.pendingHour,
    };
  }
  const delta = Math.max(0, used - current.reported);
  return {
    watermark: {
      month,
      reported: current.reported,
      pendingHour: delta > 0 ? hour : null,
      pendingReported: delta > 0 ? used : null,
    },
    delta,
    ingestHour: hour,
  };
}

export function commitWatermark(pending: MeterWatermark): MeterWatermark {
  if (pending.pendingReported === null) return pending;
  return {
    month: pending.month,
    reported: pending.pendingReported,
    pendingHour: null,
    pendingReported: null,
  };
}

async function chQuery(
  env: Pick<MeterEnv, "CLICKHOUSE_URL" | "CLICKHOUSE_USER" | "CLICKHOUSE_PASSWORD">,
  sql: string,
  params: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<string> {
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
  return response.text();
}

export async function monthToDateUsage(
  env: Pick<MeterEnv, "CLICKHOUSE_URL" | "CLICKHOUSE_USER" | "CLICKHOUSE_PASSWORD">,
  now: Date,
  fetchFn: typeof fetch,
): Promise<Map<string, number>> {
  const text = await chQuery(
    env,
    `SELECT org_id, sum(evaluations) AS evaluations
     FROM evals_per_org_day
     WHERE day >= {monthStart:Date} AND day <= {today:Date}
     GROUP BY org_id
     FORMAT JSONEachRow`,
    { monthStart: monthStartUtc(now), today: utcDay(now) },
    fetchFn,
  );
  const out = new Map<string, number>();
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const row = usageRowSchema.parse(JSON.parse(line));
    out.set(row.org_id, Number(row.evaluations));
  }
  return out;
}

export async function ingestPolarDelta(
  env: Pick<MeterEnv, "POLAR_ACCESS_TOKEN" | "POLAR_SERVER">,
  input: { customerId: string; orgId: string; hour: string; delta: number },
  fetchFn: typeof fetch,
): Promise<void> {
  const token = env.POLAR_ACCESS_TOKEN;
  if (!token) return;
  if (input.delta <= 0) return;
  const response = await fetchFn(`${polarApiBase(env.POLAR_SERVER)}/v1/events/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      events: [
        {
          name: EVALUATION_EVENT_NAME,
          external_id: polarEventExternalId(input.orgId, input.hour),
          customer_id: input.customerId,
          metadata: { [EVALUATION_EVENT_COUNT_PROPERTY]: input.delta },
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Polar ingest failed: ${response.status} ${detail.slice(0, 500)}`);
  }
}

export function sdkKeyEntryForMeter(input: {
  orgId: string;
  projectId: string;
  envSlug: string;
  hash: string;
  revoked: boolean;
  plan: OrgPlan;
  used: number;
}): SdkKeyKvEntry {
  return {
    orgId: input.orgId,
    projectId: input.projectId,
    envSlug: input.envSlug,
    hash: input.hash,
    revoked: input.revoked,
    plan: input.plan,
    quota: edgeQuotaForPlan(input.plan),
    used: input.used,
  };
}

export async function runMeterJob(
  env: MeterEnv,
  now: Date,
  fetchFn: typeof fetch = fetch,
): Promise<MeterReport> {
  const report: MeterReport = { orgs: 0, ingested: 0, stamped: 0, skipped: 0, errors: [] };
  const month = utcMonth(now);
  const hour = utcHour(now);

  const usage = await monthToDateUsage(env, now, fetchFn);
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetchFn(input, init) },
  });

  const { data: orgRows, error: orgError } = await supabase
    .from("orgs")
    .select("id, plan, polar_customer_id");
  if (orgError) throw new Error(`orgs query failed: ${orgError.message}`);

  const orgs = (orgRows ?? []).map((row) => orgRowSchema.parse(row));
  const orgById = new Map(orgs.map((org) => [org.id, org]));

  const { data: keyRows, error: keyError } = await supabase
    .from("api_keys")
    .select("prefix, hash, org_id, project_id, revoked_at, environments!inner(slug)")
    .eq("kind", "sdk")
    .not("project_id", "is", null);
  if (keyError) throw new Error(`api_keys query failed: ${keyError.message}`);

  const keys: z.infer<typeof sdkKeyRowSchema>[] = [];
  for (const row of keyRows ?? []) {
    const envSlug =
      row.environments && typeof row.environments === "object" && "slug" in row.environments
        ? String((row.environments as { slug: unknown }).slug)
        : "";
    keys.push(
      sdkKeyRowSchema.parse({
        prefix: row.prefix,
        hash: row.hash,
        org_id: row.org_id,
        project_id: row.project_id,
        env_slug: envSlug,
        revoked_at: row.revoked_at,
      }),
    );
  }

  const keysByOrg = new Map<string, z.infer<typeof sdkKeyRowSchema>[]>();
  for (const key of keys) {
    const list = keysByOrg.get(key.org_id) ?? [];
    list.push(key);
    keysByOrg.set(key.org_id, list);
  }

  const orgIds = new Set<string>([...usage.keys(), ...keysByOrg.keys()]);
  report.orgs = orgIds.size;

  for (const orgId of orgIds) {
    const org = orgById.get(orgId);
    if (!org) {
      report.skipped += 1;
      continue;
    }
    const used = usage.get(orgId) ?? 0;
    try {
      const current = parseWatermark(await env.CONFIG_KV.get(meterKvKey(orgId), { type: "json" }), month);
      const step = nextWatermark({ month, hour, used, current });
      const canPolar = Boolean(org.polar_customer_id && env.POLAR_ACCESS_TOKEN);
      // Only advance the Polar watermark after a successful ingest. Skipping
      // (trial, no customer yet, token unset) leaves reported=0 so the first
      // billed hour can still send month-to-date. Pending survives Polar
      // failures so the next hour retries the same external_id.
      if (step.delta > 0 && canPolar && org.polar_customer_id) {
        await env.CONFIG_KV.put(meterKvKey(orgId), JSON.stringify(step.watermark));
        await ingestPolarDelta(
          env,
          {
            customerId: org.polar_customer_id,
            orgId,
            hour: step.ingestHour,
            delta: step.delta,
          },
          fetchFn,
        );
        await env.CONFIG_KV.put(meterKvKey(orgId), JSON.stringify(commitWatermark(step.watermark)));
        report.ingested += 1;
      } else if (step.delta > 0) {
        report.skipped += 1;
      } else if (step.watermark.pendingHour !== null) {
        await env.CONFIG_KV.put(meterKvKey(orgId), JSON.stringify(commitWatermark(step.watermark)));
      }

      const orgKeys = keysByOrg.get(orgId) ?? [];
      for (const key of orgKeys) {
        await env.CONFIG_KV.put(
          sdkKeyKvKey(key.prefix),
          JSON.stringify(
            sdkKeyEntryForMeter({
              orgId,
              projectId: key.project_id,
              envSlug: key.env_slug,
              hash: key.hash,
              revoked: key.revoked_at !== null,
              plan: org.plan,
              used,
            }),
          ),
        );
        report.stamped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push(`${orgId}: ${message}`);
    }
  }

  return report;
}

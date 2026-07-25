/**
 * ClickHouse read helpers for usage + per-flag stats. Queries go over the
 * HTTP interface with basic auth and bound parameters ({name:Type}), FORMAT
 * JSONEachRow. When CLICKHOUSE_URL is unset the helpers return [] with a
 * console.warn so the dashboard degrades gracefully in dev.
 */

import { optionalEnv } from "./env";
import { reportServerError } from "./observability";

interface ClickHouseConfig {
  url: string;
  user: string;
  password: string;
}

/**
 * ClickHouse Cloud serves only over https and 301-redirects http → https.
 * `fetch` drops the Authorization header across that (cross-scheme) redirect,
 * so an http:// URL makes every read fail auth and return []. Upgrade the
 * scheme for any non-local host so a stray http:// in the env can't silently
 * blank out analytics.
 */
function normalizeClickhouseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".localhost");
    if (url.protocol === "http:" && !isLocal) {
      url.protocol = "https:";
      return url.toString().replace(/\/$/, "");
    }
    return raw;
  } catch {
    return raw;
  }
}

function clickhouseConfig(): ClickHouseConfig | null {
  const url = optionalEnv("CLICKHOUSE_URL");
  if (!url) return null;
  return {
    url: normalizeClickhouseUrl(url),
    user: optionalEnv("CLICKHOUSE_USER") ?? "default",
    password: optionalEnv("CLICKHOUSE_PASSWORD") ?? "",
  };
}

async function chQuery<T>(sql: string, params: Record<string, string | number>): Promise<T[]> {
  const config = clickhouseConfig();
  if (!config) {
    console.warn("[clickhouse] unconfigured, returning empty result");
    return [];
  }

  const url = new URL(config.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`param_${key}`, String(value));
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${config.user}:${config.password}`).toString("base64"),
        "Content-Type": "text/plain",
      },
      body: `${sql} FORMAT JSONEachRow`,
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[clickhouse] query failed: ${res.status} ${detail}`);
      reportServerError("clickhouse query failed", { status: res.status, detail: detail.slice(0, 500) });
      return [];
    }
    const text = await res.text();
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch (err) {
    console.error("[clickhouse] query failed:", err);
    reportServerError("clickhouse query failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export interface UsageDayRow {
  day: string;
  evaluations: number;
}

/** Evaluations per day for an org, from the evals_per_org_day billing meter. */
export async function usageByDay(orgId: string, days: number): Promise<UsageDayRow[]> {
  const rows = await chQuery<{ day: string; evaluations: string | number }>(
    `SELECT day, sum(evaluations) AS evaluations
     FROM evals_per_org_day
     WHERE org_id = {orgId:String} AND day >= today() - {days:UInt32}
     GROUP BY day
     ORDER BY day ASC`,
    { orgId, days },
  );
  return rows.map((row) => ({ day: row.day, evaluations: Number(row.evaluations) }));
}

export interface FlagStatRow {
  hour: string;
  variation: string;
  evaluations: number;
}

export type AnalyticsPeriod = "24h" | "7d" | "30d" | "90d";

export const PERIOD_HOURS: Record<AnalyticsPeriod, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};

export const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Hourly per-variation evaluation counts for one flag in one environment. */
export async function flagStats(
  orgId: string,
  projectId: string,
  envSlug: string,
  flagKey: string,
  period: AnalyticsPeriod,
): Promise<FlagStatRow[]> {
  const rows = await chQuery<{ hour: string; variation: string; evaluations: string | number }>(
    `SELECT hour, variation, sum(evaluations) AS evaluations
     FROM evals_per_flag_hour
     WHERE org_id = {orgId:String}
       AND project_id = {projectId:String}
       AND env = {env:String}
       AND flag_key = {flagKey:String}
       AND hour >= now() - INTERVAL {hours:UInt32} HOUR
     GROUP BY hour, variation
     ORDER BY hour ASC`,
    { orgId, projectId, env: envSlug, flagKey, hours: PERIOD_HOURS[period] },
  );
  return rows.map((row) => ({
    hour: row.hour,
    variation: row.variation,
    evaluations: Number(row.evaluations),
  }));
}

// ── Analytics (evals_per_flag_country_hour) ─────────────────────────────────
//
// Everything below reads the per-flag/per-country hourly MV; org-wide numbers
// are sums over its dimensions, so all breakdowns agree with each other.

export interface AnalyticsFilter {
  orgId: string;
  projectId?: string;
  envSlug?: string;
  /** Set to scope everything to one flag (flag detail page). */
  flagKey?: string;
  /** ISO 3166-1 alpha-2 — scope series/flags/envs to one country. */
  country?: string;
  /**
   * Region/state name (cf.region, with city fallback for older rows).
   * Only meaningful with `country` set.
   */
  region?: string;
}

interface FilterSql {
  where: string;
  params: Record<string, string | number>;
}

function analyticsFilterSql(
  filter: AnalyticsFilter,
  hours: number,
  timeColumn: "hour" | "ts" = "hour",
): FilterSql {
  const clauses = [
    "org_id = {orgId:String}",
    `${timeColumn} >= now() - INTERVAL {hours:UInt32} HOUR`,
  ];
  const params: Record<string, string | number> = { orgId: filter.orgId, hours };
  if (filter.projectId !== undefined) {
    clauses.push("project_id = {projectId:String}");
    params.projectId = filter.projectId;
  }
  if (filter.envSlug !== undefined) {
    clauses.push("env = {env:String}");
    params.env = filter.envSlug;
  }
  if (filter.flagKey !== undefined) {
    clauses.push("flag_key = {flagKey:String}");
    params.flagKey = filter.flagKey;
  }
  if (filter.country !== undefined) {
    clauses.push("country = {country:String}");
    params.country = filter.country;
  }
  // Region only exists on raw `evaluations` (ts), not on hourly MVs.
  if (filter.region !== undefined && timeColumn === "ts") {
    // Match the same expression used in analyticsByRegion grouping.
    clauses.push("if(region != '', region, city) = {region:String}");
    params.region = filter.region;
  }
  return { where: clauses.join(" AND "), params };
}

export interface AnalyticsSeriesRow {
  /** Hour start for 24h, day for longer periods (UTC). */
  bucket: string;
  evaluations: number;
}

/** Evaluation counts over time: hourly buckets for 24h, daily otherwise. */
export async function analyticsSeries(
  filter: AnalyticsFilter,
  period: AnalyticsPeriod,
): Promise<AnalyticsSeriesRow[]> {
  const bucketExpr = period === "24h" ? "toString(hour)" : "toString(toDate(hour))";
  const { where, params } = analyticsFilterSql(filter, PERIOD_HOURS[period]);
  const rows = await chQuery<{ bucket: string; evaluations: string | number }>(
    `SELECT ${bucketExpr} AS bucket, sum(evaluations) AS evaluations
     FROM evals_per_flag_country_hour
     WHERE ${where}
     GROUP BY bucket
     ORDER BY bucket ASC`,
    params,
  );
  return rows.map((row) => ({ bucket: row.bucket, evaluations: Number(row.evaluations) }));
}

export interface AnalyticsCountryRow {
  /** ISO 3166-1 alpha-2, or "unknown". */
  country: string;
  evaluations: number;
}

/** Evaluations by client country, largest first. */
export async function analyticsByCountry(
  filter: AnalyticsFilter,
  period: AnalyticsPeriod,
  limit = 50,
): Promise<AnalyticsCountryRow[]> {
  const { where, params } = analyticsFilterSql(filter, PERIOD_HOURS[period]);
  const rows = await chQuery<{ country: string; evaluations: string | number }>(
    `SELECT country, sum(evaluations) AS evaluations
     FROM evals_per_flag_country_hour
     WHERE ${where}
     GROUP BY country
     ORDER BY evaluations DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit },
  );
  return rows.map((row) => ({ country: row.country, evaluations: Number(row.evaluations) }));
}

export interface AnalyticsFlagRow {
  flagKey: string;
  evaluations: number;
}

/** Evaluations by flag, largest first. */
export async function analyticsByFlag(
  filter: AnalyticsFilter,
  period: AnalyticsPeriod,
  limit = 20,
): Promise<AnalyticsFlagRow[]> {
  const { where, params } = analyticsFilterSql(filter, PERIOD_HOURS[period]);
  const rows = await chQuery<{ flag_key: string; evaluations: string | number }>(
    `SELECT flag_key, sum(evaluations) AS evaluations
     FROM evals_per_flag_country_hour
     WHERE ${where}
     GROUP BY flag_key
     ORDER BY evaluations DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit },
  );
  return rows.map((row) => ({ flagKey: row.flag_key, evaluations: Number(row.evaluations) }));
}

export interface AnalyticsEnvRow {
  env: string;
  evaluations: number;
}

/** Evaluations by environment, largest first. */
export async function analyticsByEnv(
  filter: AnalyticsFilter,
  period: AnalyticsPeriod,
): Promise<AnalyticsEnvRow[]> {
  const { where, params } = analyticsFilterSql(filter, PERIOD_HOURS[period]);
  const rows = await chQuery<{ env: string; evaluations: string | number }>(
    `SELECT env, sum(evaluations) AS evaluations
     FROM evals_per_flag_country_hour
     WHERE ${where}
     GROUP BY env
     ORDER BY evaluations DESC`,
    params,
  );
  return rows.map((row) => ({ env: row.env, evaluations: Number(row.evaluations) }));
}

export interface AnalyticsRegionRow {
  region: string;
  lat: number;
  lng: number;
  evaluations: number;
}

/**
 * Region/state rollup for a country-scoped analytics view.
 * Prefers `region` (cf.region); falls back to `city` for older rows.
 * Reads hot raw `evaluations` (7-day TTL).
 */
export async function analyticsByRegion(
  filter: AnalyticsFilter,
  period: AnalyticsPeriod,
  limit = 500,
): Promise<AnalyticsRegionRow[]> {
  if (filter.country === undefined) return [];
  const { where, params } = analyticsFilterSql(filter, PERIOD_HOURS[period], "ts");
  // Alias must not be `lat`/`lng` — ClickHouse can resolve those names in WHERE
  // to the SELECT aliases, turning `lat IS NOT NULL` into an illegal aggregation.
  const rows = await chQuery<{
    region: string;
    avg_lat: string | number;
    avg_lng: string | number;
    evaluations: string | number;
  }>(
    `SELECT
       if(region != '', region, city) AS region,
       avg(lat) AS avg_lat,
       avg(lng) AS avg_lng,
       count() AS evaluations
     FROM evaluations
     WHERE ${where}
       AND (region != '' OR city != '')
       AND lat IS NOT NULL
       AND lng IS NOT NULL
     GROUP BY region
     ORDER BY evaluations DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit },
  );
  return rows.map((row) => ({
    region: row.region,
    lat: Number(row.avg_lat),
    lng: Number(row.avg_lng),
    evaluations: Number(row.evaluations),
  }));
}

export interface AnalyticsCityRow {
  city: string;
  lat: number;
  lng: number;
  evaluations: number;
}

/**
 * City rollup for a region-scoped analytics view.
 * Requires country + region on the filter.
 */
export async function analyticsByCity(
  filter: AnalyticsFilter,
  period: AnalyticsPeriod,
  limit = 500,
): Promise<AnalyticsCityRow[]> {
  if (filter.country === undefined || filter.region === undefined) return [];
  const { where, params } = analyticsFilterSql(filter, PERIOD_HOURS[period], "ts");
  const rows = await chQuery<{
    city: string;
    avg_lat: string | number;
    avg_lng: string | number;
    evaluations: string | number;
  }>(
    `SELECT
       city,
       avg(lat) AS avg_lat,
       avg(lng) AS avg_lng,
       count() AS evaluations
     FROM evaluations
     WHERE ${where}
       AND city != ''
       AND lat IS NOT NULL
       AND lng IS NOT NULL
     GROUP BY city
     ORDER BY evaluations DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit },
  );
  return rows.map((row) => ({
    city: row.city,
    lat: Number(row.avg_lat),
    lng: Number(row.avg_lng),
    evaluations: Number(row.evaluations),
  }));
}

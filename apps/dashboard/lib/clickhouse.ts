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

function clickhouseConfig(): ClickHouseConfig | null {
  const url = optionalEnv("CLICKHOUSE_URL");
  if (!url) return null;
  return {
    url,
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

const PERIOD_HOURS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

/** Hourly per-variation evaluation counts for one flag in one environment. */
export async function flagStats(
  orgId: string,
  projectId: string,
  envSlug: string,
  flagKey: string,
  period: "24h" | "7d" | "30d",
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

/**
 * ClickHouse read helpers for cross-org usage analytics. Same access
 * pattern as the dashboard app (HTTP interface, bound parameters, FORMAT
 * JSONEachRow); when CLICKHOUSE_URL is unset every helper returns [] with a
 * console.warn so the admin app degrades gracefully in dev.
 */

import { optionalEnv } from "./env";

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
      console.error(`[clickhouse] query failed: ${res.status} ${await res.text()}`);
      return [];
    }
    const text = await res.text();
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch (err) {
    console.error("[clickhouse] query failed:", err);
    return [];
  }
}

export interface EvalsDayRow {
  day: string;
  evaluations: number;
}

/** Evaluations per day across ALL orgs (platform-wide meter). */
export async function evalsPerDayAll(days: number): Promise<EvalsDayRow[]> {
  const rows = await chQuery<{ day: string; evaluations: string | number }>(
    `SELECT day, sum(evaluations) AS evaluations
     FROM evals_per_org_day
     WHERE day >= today() - {days:UInt32}
     GROUP BY day
     ORDER BY day ASC`,
    { days },
  );
  return rows.map((row) => ({ day: row.day, evaluations: Number(row.evaluations) }));
}

/** Evaluations per day for one org. */
export async function evalsPerDayOrg(orgId: string, days: number): Promise<EvalsDayRow[]> {
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

export interface OrgEvalsRow {
  org_id: string;
  evaluations: number;
}

/** Top orgs by evaluations over the trailing window. */
export async function topOrgsByEvals(days: number, limit: number): Promise<OrgEvalsRow[]> {
  const rows = await chQuery<{ org_id: string; evaluations: string | number }>(
    `SELECT org_id, sum(evaluations) AS evaluations
     FROM evals_per_org_day
     WHERE day >= today() - {days:UInt32}
     GROUP BY org_id
     ORDER BY evaluations DESC
     LIMIT {limit:UInt32}`,
    { days, limit },
  );
  return rows.map((row) => ({ org_id: row.org_id, evaluations: Number(row.evaluations) }));
}

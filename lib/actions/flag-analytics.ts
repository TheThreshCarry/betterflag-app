"use server"

import { getClickHouseClient } from "@/lib/clickhouse"
import { getOrganizationId } from "@/lib/actions/utils"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimeseriesPoint {
  date: string
  evaluations: number
  unique_users: number
}

export interface CountryBreakdown {
  country: string
  evaluations: number
  unique_users: number
}

export interface FlagSummaryStats {
  total_evaluations: number
  unique_users: number
  top_country: string
  avg_daily_evaluations: number
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Evaluations over time for a specific flag (last 30 days, grouped by day).
 * Used by the area chart on the flag detail page.
 */
export async function getFlagEvaluationsTimeseries(
  flagKey: string
): Promise<TimeseriesPoint[]> {
  const orgId = await getOrganizationId()
  if (!orgId) return []

  const client = getClickHouseClient()
  const result = await client.query({
    query: `
      SELECT
        toDate(timestamp) AS date,
        count()            AS evaluations,
        uniq(customer_id)  AS unique_users
      FROM feature_flag_evaluations
      WHERE organization_id = {org_id:String}
        AND flag_key         = {flag_key:String}
        AND timestamp       >= now() - INTERVAL 30 DAY
      GROUP BY date
      ORDER BY date
    `,
    format: "JSONEachRow",
    query_params: { org_id: orgId, flag_key: flagKey },
  })

  const rows = await result.json<TimeseriesPoint[]>()

  // ClickHouse returns numbers as strings in JSON — cast them
  return rows.map((r) => ({
    date: r.date,
    evaluations: Number(r.evaluations),
    unique_users: Number(r.unique_users),
  }))
}

/**
 * Top 10 countries by evaluation count for a specific flag (last 30 days).
 */
export async function getFlagCountryBreakdown(
  flagKey: string
): Promise<CountryBreakdown[]> {
  const orgId = await getOrganizationId()
  if (!orgId) return []

  const client = getClickHouseClient()
  const result = await client.query({
    query: `
      SELECT
        country,
        count()            AS evaluations,
        uniq(customer_id)  AS unique_users
      FROM feature_flag_evaluations
      WHERE organization_id = {org_id:String}
        AND flag_key         = {flag_key:String}
        AND timestamp       >= now() - INTERVAL 30 DAY
        AND country         != ''
      GROUP BY country
      ORDER BY evaluations DESC
      LIMIT 10
    `,
    format: "JSONEachRow",
    query_params: { org_id: orgId, flag_key: flagKey },
  })

  const rows = await result.json<CountryBreakdown[]>()
  return rows.map((r) => ({
    country: r.country,
    evaluations: Number(r.evaluations),
    unique_users: Number(r.unique_users),
  }))
}

/**
 * Summary stats for a specific flag (last 30 days).
 */
export async function getFlagSummaryStats(
  flagKey: string
): Promise<FlagSummaryStats> {
  const orgId = await getOrganizationId()
  if (!orgId)
    return {
      total_evaluations: 0,
      unique_users: 0,
      top_country: "-",
      avg_daily_evaluations: 0,
    }

  const client = getClickHouseClient()

  // Summary aggregates
  const summaryResult = await client.query({
    query: `
      SELECT
        count()                                           AS total_evaluations,
        uniq(customer_id)                                 AS unique_users,
        round(count() / greatest(dateDiff('day',
          toDate(min(timestamp)), toDate(max(timestamp))) + 1, 1)) AS avg_daily_evaluations
      FROM feature_flag_evaluations
      WHERE organization_id = {org_id:String}
        AND flag_key         = {flag_key:String}
        AND timestamp       >= now() - INTERVAL 30 DAY
    `,
    format: "JSONEachRow",
    query_params: { org_id: orgId, flag_key: flagKey },
  })

  const summary = (await summaryResult.json<any[]>())[0] || {
    total_evaluations: 0,
    unique_users: 0,
    avg_daily_evaluations: 0,
  }

  // Top country
  const countryResult = await client.query({
    query: `
      SELECT country
      FROM feature_flag_evaluations
      WHERE organization_id = {org_id:String}
        AND flag_key         = {flag_key:String}
        AND timestamp       >= now() - INTERVAL 30 DAY
        AND country         != ''
      GROUP BY country
      ORDER BY count() DESC
      LIMIT 1
    `,
    format: "JSONEachRow",
    query_params: { org_id: orgId, flag_key: flagKey },
  })

  const topCountryRow = (await countryResult.json<{ country: string }[]>())[0]

  return {
    total_evaluations: Number(summary.total_evaluations),
    unique_users: Number(summary.unique_users),
    top_country: topCountryRow?.country || "-",
    avg_daily_evaluations: Number(summary.avg_daily_evaluations),
  }
}

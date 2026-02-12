"use server"

import { z } from "zod"
import { getClickHouseClient } from "@/lib/clickhouse"
import { getOrganizationId } from "@/lib/actions/utils"

// ─── Schemas ─────────────────────────────────────────────────────────────────

const TimeseriesPointSchema = z.object({
  date: z.string(),
  evaluations: z.number(),
  unique_users: z.number(),
})

const CountryBreakdownSchema = z.object({
  country: z.string(),
  evaluations: z.number(),
  unique_users: z.number(),
})

const FlagSummaryStatsSchema = z.object({
  total_evaluations: z.number(),
  unique_users: z.number(),
  top_country: z.string(),
  avg_daily_evaluations: z.number(),
})

const GeoPointSchema = z.object({
  city: z.string(),
  country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  evaluations: z.number(),
  unique_users: z.number(),
})

// ─── Types (inferred from schemas) ──────────────────────────────────────────

export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>
export type CountryBreakdown = z.infer<typeof CountryBreakdownSchema>
export type FlagSummaryStats = z.infer<typeof FlagSummaryStatsSchema>
export type GeoPoint = z.infer<typeof GeoPointSchema>

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

  const rows = (await result.json()) as Record<string, unknown>[]

  // ClickHouse returns numbers as strings in JSON — cast them
  const parsed = z.array(TimeseriesPointSchema).safeParse(
    rows.map((r) => ({
      date: r.date,
      evaluations: Number(r.evaluations),
      unique_users: Number(r.unique_users),
    }))
  )

  if (!parsed.success) {
    console.error("getFlagEvaluationsTimeseries: validation failed", parsed.error.flatten())
    return []
  }

  return parsed.data
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

  const rows = (await result.json()) as Record<string, unknown>[]

  const parsed = z.array(CountryBreakdownSchema).safeParse(
    rows.map((r) => ({
      country: r.country,
      evaluations: Number(r.evaluations),
      unique_users: Number(r.unique_users),
    }))
  )

  if (!parsed.success) {
    console.error("getFlagCountryBreakdown: validation failed", parsed.error.flatten())
    return []
  }

  return parsed.data
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

  const summaryRows = (await summaryResult.json()) as Record<string, unknown>[]
  const summary = summaryRows[0] || {
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

  const countryRows = (await countryResult.json()) as Record<string, unknown>[]
  const topCountryRow = countryRows[0] as { country?: string } | undefined

  const parsed = FlagSummaryStatsSchema.safeParse({
    total_evaluations: Number(summary.total_evaluations),
    unique_users: Number(summary.unique_users),
    top_country: topCountryRow?.country || "-",
    avg_daily_evaluations: Number(summary.avg_daily_evaluations),
  })

  if (!parsed.success) {
    console.error("getFlagSummaryStats: validation failed", parsed.error.flatten())
    return {
      total_evaluations: 0,
      unique_users: 0,
      top_country: "-",
      avg_daily_evaluations: 0,
    }
  }

  return parsed.data
}

/**
 * Geo-aggregated evaluation points for a specific flag (last 30 days).
 * Groups by city + country and returns average coordinates with counts.
 * Used by the map visualization on the flag detail page.
 */
export async function getFlagGeoPoints(
  flagKey: string
): Promise<GeoPoint[]> {
  const orgId = await getOrganizationId()
  if (!orgId) return []

  const client = getClickHouseClient()
  const result = await client.query({
    query: `
      SELECT
        city,
        country,
        round(avg(latitude), 4)  AS lat,
        round(avg(longitude), 4) AS lng,
        count()                  AS evaluations,
        uniq(customer_id)        AS unique_users
      FROM feature_flag_evaluations
      WHERE organization_id = {org_id:String}
        AND flag_key         = {flag_key:String}
        AND timestamp       >= now() - INTERVAL 30 DAY
        AND latitude         != 0
        AND longitude        != 0
      GROUP BY city, country
      ORDER BY evaluations DESC
      LIMIT 500
    `,
    format: "JSONEachRow",
    query_params: { org_id: orgId, flag_key: flagKey },
  })

  const rows = (await result.json()) as Record<string, unknown>[]

  const parsed = z.array(GeoPointSchema).safeParse(
    rows.map((r) => ({
      city: r.city,
      country: r.country,
      latitude: Number(r.lat),
      longitude: Number(r.lng),
      evaluations: Number(r.evaluations),
      unique_users: Number(r.unique_users),
    }))
  )

  if (!parsed.success) {
    console.error("getFlagGeoPoints: validation failed", parsed.error.flatten())
    return []
  }

  return parsed.data
}

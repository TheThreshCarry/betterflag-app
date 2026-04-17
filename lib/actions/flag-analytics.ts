"use server"

import { z } from "zod"
import { getOrganizationId } from "@/lib/actions/utils"
import { getSupabaseSessionOptional } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { createLogger } from "@/lib/logger"
import { queryPipe, toIsoDate, daysAgo } from "@/lib/tinybird"

// ─── Schemas ────────────────────────────────────────────────────────────────

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

export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>
export type CountryBreakdown = z.infer<typeof CountryBreakdownSchema>
export type FlagSummaryStats = z.infer<typeof FlagSummaryStatsSchema>
export type GeoPoint = z.infer<typeof GeoPointSchema>

// ─── Queries (Tinybird Pipes) ───────────────────────────────────────────────

/**
 * Evaluations over time for a specific flag (last 30 days, daily buckets).
 * Backed by `tinybird/pipes/flag_evals_timeseries.pipe`.
 */
export async function getFlagEvaluationsTimeseries(
  flagKey: string,
): Promise<TimeseriesPoint[]> {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.analytics", session) : createLogger("actions.analytics")
  const orgId = await getOrganizationId()
  if (!orgId) return []

  try {
    const { data } = await queryPipe<{
      ts: string
      flag_key: string
      enabled_count: number
      disabled_count: number
      total: number
    }>("flag_evals_timeseries", {
      organization_id: orgId,
      flag_key: flagKey,
      from: toIsoDate(daysAgo(30)),
      to: toIsoDate(new Date()),
      bucket_minutes: 1440,
    })

    const parsed = z.array(TimeseriesPointSchema).safeParse(
      data.map((r) => ({
        date: r.ts,
        evaluations: Number(r.total),
        unique_users: 0,
      })),
    )
    if (!parsed.success) {
      log.error(
        { flagKey, errors: parsed.error.flatten() },
        "timeseries validation failed",
      )
      return []
    }
    return parsed.data
  } catch (err) {
    log.error({ flagKey, err }, "timeseries query failed")
    return []
  }
}

/**
 * Top 10 countries for a flag (last 30 days).
 * Backed by `tinybird/pipes/flag_evals_by_country.pipe`.
 */
export async function getFlagCountryBreakdown(
  flagKey: string,
): Promise<CountryBreakdown[]> {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.analytics", session) : createLogger("actions.analytics")
  const orgId = await getOrganizationId()
  if (!orgId) return []

  try {
    const { data } = await queryPipe<{
      country: string
      evaluations: number
      customers: number
    }>("flag_evals_by_country", {
      organization_id: orgId,
      flag_key: flagKey,
      from: toIsoDate(daysAgo(30)),
      to: toIsoDate(new Date()),
      limit: 10,
    })

    const parsed = z.array(CountryBreakdownSchema).safeParse(
      data
        .filter((r) => r.country)
        .map((r) => ({
          country: r.country,
          evaluations: Number(r.evaluations),
          unique_users: Number(r.customers),
        })),
    )
    if (!parsed.success) {
      log.error(
        { flagKey, errors: parsed.error.flatten() },
        "country validation failed",
      )
      return []
    }
    return parsed.data
  } catch (err) {
    log.error({ flagKey, err }, "country query failed")
    return []
  }
}

/**
 * Summary stats for a flag (last 30 days).
 * Combines variant-breakdown + country pipes.
 */
export async function getFlagSummaryStats(
  flagKey: string,
): Promise<FlagSummaryStats> {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.analytics", session) : createLogger("actions.analytics")
  const orgId = await getOrganizationId()
  const empty: FlagSummaryStats = {
    total_evaluations: 0,
    unique_users: 0,
    top_country: "-",
    avg_daily_evaluations: 0,
  }
  if (!orgId) return empty

  try {
    const from = toIsoDate(daysAgo(30))
    const to = toIsoDate(new Date())

    const [variant, country] = await Promise.all([
      queryPipe<{
        flag_key: string
        enabled: number
        disabled: number
      }>("flag_evals_variant_breakdown", {
        organization_id: orgId,
        flag_key: flagKey,
        from,
        to,
      }),
      queryPipe<{ country: string; evaluations: number }>(
        "flag_evals_by_country",
        { organization_id: orgId, flag_key: flagKey, from, to, limit: 1 },
      ),
    ])

    const row = variant.data.find((r) => r.flag_key === flagKey) ?? variant.data[0]
    const total = (Number(row?.enabled ?? 0) + Number(row?.disabled ?? 0)) || 0
    const topCountry = country.data[0]?.country || "-"

    const parsed = FlagSummaryStatsSchema.safeParse({
      total_evaluations: total,
      unique_users: 0,
      top_country: topCountry,
      avg_daily_evaluations: Math.round(total / 30),
    })
    if (!parsed.success) return empty
    return parsed.data
  } catch (err) {
    log.error({ flagKey, err }, "summary query failed")
    return empty
  }
}

/**
 * Geo-aggregated evaluation points for a flag — not yet exposed as a pipe
 * (kept here as an empty-array stub to preserve the server action contract).
 * Add `flag_evals_geo.pipe` in a follow-up if the flag detail map needs it.
 */
export async function getFlagGeoPoints(
  _flagKey: string,
): Promise<GeoPoint[]> {
  return []
}

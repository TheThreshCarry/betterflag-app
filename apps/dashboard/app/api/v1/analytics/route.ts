/**
 * GET /api/v1/analytics: org-wide evaluation analytics from ClickHouse
 * (evals_per_flag_country_hour): totals, time series, country and flag and
 * environment breakdowns for a period. Optional projectId/env/flag/country/region.
 *
 * Drill-down:
 *   (none)           → countries
 *   ?country=ES      → regions
 *   ?country=ES&region=Madrid → cities
 *
 * Periods beyond the org's plan retention (ANALYTICS_RETENTION_DAYS) are
 * rejected with 422 `retention_exceeded`; the response always carries
 * `retentionDays` + `availablePeriods` so the UI can disable options.
 */
import { flagKeySchema } from "@betterflag/core";
import { ANALYTICS_RETENTION_DAYS } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { assertKeyScope, resolveActor } from "@/lib/auth";
import {
  analyticsByCity,
  analyticsByCountry,
  analyticsByEnv,
  analyticsByFlag,
  analyticsByRegion,
  analyticsSeries,
  PERIOD_DAYS,
  type AnalyticsFilter,
  type AnalyticsPeriod,
} from "@/lib/clickhouse";
import { getOrg, getProjectInOrg } from "@/lib/db";
import { HttpError, parseQuery, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PERIODS = ["24h", "7d", "30d", "90d"] as const;

const analyticsQuerySchema = z
  .object({
    period: z.enum(PERIODS).default("7d"),
    projectId: z.uuid().optional(),
    env: z.string().min(1).optional(),
    /** Flag key — scopes all rollups to a single flag (flag detail map). */
    flag: flagKeySchema.optional(),
    /** ISO 3166-1 alpha-2 — when set, series/flags/envs are scoped to that country. */
    country: z
      .string()
      .regex(/^[A-Z]{2}$/, "country must be an ISO 3166-1 alpha-2 code")
      .optional(),
    /** Region/state name — requires country; returns city rollup instead of regions. */
    region: z.string().min(1).max(120).optional(),
  })
  .refine((q) => q.region === undefined || q.country !== undefined, {
    message: "region requires country",
    path: ["region"],
  });

// Not exported: Next.js route modules may only export handlers/config.
function availablePeriods(retentionDays: number): AnalyticsPeriod[] {
  return PERIODS.filter((period) => PERIOD_DAYS[period] <= retentionDays);
}

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const query = parseQuery(request, analyticsQuerySchema);
  const service = createServiceClient();

  const org = await getOrg(service, actor.orgId);
  const retentionDays = ANALYTICS_RETENTION_DAYS[org.plan];
  const periods = availablePeriods(retentionDays);
  if (!periods.includes(query.period)) {
    throw new HttpError(
      422,
      "retention_exceeded",
      `The ${query.period} period exceeds your plan's ${retentionDays}-day analytics retention`,
    );
  }

  const filter: AnalyticsFilter = {
    orgId: actor.orgId,
    envSlug: query.env,
    country: query.country,
    region: query.region,
    flagKey: query.flag,
  };
  if (query.projectId !== undefined) {
    const project = await getProjectInOrg(service, query.projectId, actor.orgId);
    assertKeyScope(actor, project.id);
    filter.projectId = project.id;
  }

  const scopedCountry = Boolean(query.country);
  const scopedRegion = Boolean(query.country && query.region);

  const [series, countries, flags, environments, regions, cities] = await Promise.all([
    analyticsSeries(filter, query.period),
    scopedCountry ? Promise.resolve([]) : analyticsByCountry(filter, query.period),
    analyticsByFlag(filter, query.period),
    analyticsByEnv(filter, query.period),
    scopedCountry && !scopedRegion
      ? analyticsByRegion(filter, query.period)
      : Promise.resolve([]),
    scopedRegion ? analyticsByCity(filter, query.period) : Promise.resolve([]),
  ]);
  // Region isn't on the hourly MV — when region-scoped, total comes from cities.
  const total = scopedRegion
    ? cities.reduce((sum, row) => sum + row.evaluations, 0)
    : series.reduce((sum, point) => sum + point.evaluations, 0);

  return NextResponse.json({
    period: query.period,
    retentionDays,
    availablePeriods: periods,
    country: query.country ?? null,
    region: query.region ?? null,
    total,
    series,
    countries,
    flags,
    environments,
    regions,
    cities,
  });
});

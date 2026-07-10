/**
 * GET /api/v1/analytics: org-wide evaluation analytics from ClickHouse
 * (evals_per_flag_country_hour): totals, time series, country and flag and
 * environment breakdowns for a period. Optional projectId/env filters.
 *
 * Periods beyond the org's plan retention (ANALYTICS_RETENTION_DAYS) are
 * rejected with 422 `retention_exceeded`; the response always carries
 * `retentionDays` + `availablePeriods` so the UI can disable options.
 */
import { ANALYTICS_RETENTION_DAYS } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { assertKeyScope, resolveActor } from "@/lib/auth";
import {
  analyticsByCountry,
  analyticsByEnv,
  analyticsByFlag,
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

const analyticsQuerySchema = z.object({
  period: z.enum(PERIODS).default("7d"),
  projectId: z.uuid().optional(),
  env: z.string().min(1).optional(),
});

// Not exported: Next.js route modules may only export handlers/config.
function availablePeriods(retentionDays: number): AnalyticsPeriod[] {
  return PERIODS.filter((period) => PERIOD_DAYS[period] <= retentionDays);
}

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const query = parseQuery(request, analyticsQuerySchema.passthrough()) as z.infer<
    typeof analyticsQuerySchema
  >;
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

  const filter: AnalyticsFilter = { orgId: actor.orgId, envSlug: query.env };
  if (query.projectId !== undefined) {
    const project = await getProjectInOrg(service, query.projectId, actor.orgId);
    assertKeyScope(actor, project.id);
    filter.projectId = project.id;
  }

  const [series, countries, flags, environments] = await Promise.all([
    analyticsSeries(filter, query.period),
    analyticsByCountry(filter, query.period),
    analyticsByFlag(filter, query.period),
    analyticsByEnv(filter, query.period),
  ]);
  const total = series.reduce((sum, point) => sum + point.evaluations, 0);

  return NextResponse.json({
    period: query.period,
    retentionDays,
    availablePeriods: periods,
    total,
    series,
    countries,
    flags,
    environments,
  });
});

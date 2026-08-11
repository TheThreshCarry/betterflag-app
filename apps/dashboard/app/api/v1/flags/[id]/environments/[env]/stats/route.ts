import { ANALYTICS_RETENTION_DAYS } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { assertKeyScope, resolveActor } from "@/lib/auth";
import {
  analyticsByCountry,
  flagStats,
  PERIOD_DAYS,
  type AnalyticsPeriod,
} from "@/lib/clickhouse";
import { getEnvironmentBySlug, getFlagInOrg, getOrg } from "@/lib/db";
import { HttpError, parseQuery, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PERIODS = ["24h", "7d", "30d", "90d"] as const;

const statsQuerySchema = z.object({
  period: z.enum(PERIODS).default("24h"),
});

// Not exported: Next.js route modules may only export handlers/config.
function availablePeriods(retentionDays: number): AnalyticsPeriod[] {
  return PERIODS.filter((period) => PERIOD_DAYS[period] <= retentionDays);
}

export const GET = withErrors<{ id: string; env: string }>(
  async (request: NextRequest, { params }) => {
    const { id, env: envSlug } = await params;
    const actor = await resolveActor(request);
    const { period } = parseQuery(request, statsQuerySchema.passthrough()) as z.infer<
      typeof statsQuerySchema
    >;
    const service = createServiceClient();

    const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
    assertKeyScope(actor, project.id);
    const environment = await getEnvironmentBySlug(service, project.id, envSlug);

    const org = await getOrg(service, actor.orgId);
    const retentionDays = ANALYTICS_RETENTION_DAYS[org.plan];
    const periods = availablePeriods(retentionDays);
    if (!periods.includes(period)) {
      throw new HttpError(
        422,
        "retention_exceeded",
        `The ${period} period exceeds your plan's ${retentionDays}-day analytics retention`,
      );
    }

    const filter = {
      orgId: actor.orgId,
      projectId: project.id,
      envSlug: environment.slug,
      flagKey: flag.key,
    };
    const [series, countries] = await Promise.all([
      flagStats(actor.orgId, project.id, environment.slug, flag.key, period),
      analyticsByCountry(filter, period),
    ]);

    return NextResponse.json({
      period,
      retentionDays,
      availablePeriods: periods,
      series,
      countries,
    });
  },
);

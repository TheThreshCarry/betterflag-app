import { PLAN_LIMITS } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { ApiUsage } from "@/lib/api-types";
import { resolveActor } from "@/lib/auth";
import { usageByDay } from "@/lib/clickhouse";
import { getOrg } from "@/lib/db";
import { parseQuery, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const usageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const { days } = parseQuery(request, usageQuerySchema.passthrough()) as z.infer<
    typeof usageQuerySchema
  >;
  const service = createServiceClient();

  const org = await getOrg(service, actor.orgId);
  const series = await usageByDay(actor.orgId, days);
  const used = series.reduce((total, point) => total + point.evaluations, 0);

  const usage: ApiUsage = {
    plan: org.plan,
    trialEndsAt: org.trial_ends_at,
    includedEvalsPerMonth: PLAN_LIMITS[org.plan].includedEvalsPerMonth,
    used,
    series,
  };

  return NextResponse.json(usage);
});

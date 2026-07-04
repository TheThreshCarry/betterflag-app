import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { assertKeyScope, resolveActor } from "@/lib/auth";
import { flagStats } from "@/lib/clickhouse";
import { getEnvironmentBySlug, getFlagInOrg } from "@/lib/db";
import { parseQuery, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const statsQuerySchema = z.object({
  period: z.enum(["24h", "7d", "30d"]).default("24h"),
});

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

    const series = await flagStats(actor.orgId, project.id, environment.slug, flag.key, period);

    return NextResponse.json({ period, series });
  },
);

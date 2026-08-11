import type { FlagConfigRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { getEnvironmentBySlug, getFlagInOrg } from "@/lib/db";
import { unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { rebuildAndPushSnapshot } from "@/lib/sync";

export const runtime = "nodejs";

export const POST = withErrors<{ id: string; env: string }>(
  async (request: NextRequest, { params }) => {
    const { id, env: envSlug } = await params;
    const actor = await resolveActor(request);
    const service = createServiceClient();

    const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
    assertKeyScope(actor, project.id);
    const environment = await getEnvironmentBySlug(service, project.id, envSlug);

    const audit = auditActor(actor);
    const config = unwrap(
      await service.rpc("kill_flag", {
        p_flag: flag.id,
        p_environment: environment.id,
        p_actor_type: audit.actorType,
        p_actor_id: audit.actorId,
        p_actor_key_prefix: audit.actorKeyPrefix,
      }),
    ) as FlagConfigRow;

    // Emergency path: rebuild the snapshot and write KV synchronously so the
    // kill lands at the edge in seconds, then enqueue reconciliation.
    await rebuildAndPushSnapshot(
      service,
      project.id,
      environment.id,
      environment.slug,
      actor.orgId,
    );

    return NextResponse.json({ config: toApiFlagConfig(config) });
  },
);

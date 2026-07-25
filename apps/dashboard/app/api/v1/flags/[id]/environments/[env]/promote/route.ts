import { targetingRulesSchema } from "@shipos/core";
import type { FlagConfigRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { getEnvironmentBySlug, getFlagConfig, getFlagInOrg } from "@/lib/db";
import { HttpError, parseJson, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { rebuildAndPushSnapshot } from "@/lib/sync";

export const runtime = "nodejs";

const promoteSchema = z.object({
  fromEnv: z.string().min(1).max(31),
});

export const POST = withErrors<{ id: string; env: string }>(
  async (request: NextRequest, { params }) => {
    const { id, env: envSlug } = await params;
    const actor = await resolveActor(request);
    const body = await parseJson(request, promoteSchema);
    const service = createServiceClient();

    const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
    assertKeyScope(actor, project.id);
    await assertOrgWritable(service, actor.orgId);

    if (body.fromEnv === envSlug) {
      throw new HttpError(400, "invalid_promote", "Source and target environments are the same");
    }

    const target = await getEnvironmentBySlug(service, project.id, envSlug);
    const source = await getEnvironmentBySlug(service, project.id, body.fromEnv);
    const sourceConfig = await getFlagConfig(service, flag.id, source.id);

    // Values copied verbatim from the source env.
    const parsedRules = targetingRulesSchema.safeParse(sourceConfig.rules);
    const patch = {
      enabled: sourceConfig.enabled,
      rolloutPct: sourceConfig.rollout_pct,
      ...(parsedRules.success ? { rules: parsedRules.data } : {}),
      ...(sourceConfig.value_on !== null ? { valueOn: sourceConfig.value_on } : {}),
      ...(sourceConfig.value_off !== null ? { valueOff: sourceConfig.value_off } : {}),
    };

    const audit = auditActor(actor);
    const config = unwrap(
      await service.rpc("update_flag_config", {
        p_flag: flag.id,
        p_environment: target.id,
        p_enabled: patch.enabled ?? null,
        p_rollout_pct: patch.rolloutPct ?? null,
        p_rules: patch.rules ?? null,
        p_value_on: patch.valueOn ?? null,
        p_value_off: patch.valueOff ?? null,
        p_clear_kill: null,
        p_expected_version: null,
        p_actor_type: audit.actorType,
        p_actor_id: audit.actorId,
        p_actor_key_prefix: audit.actorKeyPrefix,
      }),
    ) as FlagConfigRow;

    await rebuildAndPushSnapshot(
      service,
      project.id,
      target.id,
      target.slug,
      actor.orgId,
    );

    return NextResponse.json({ config: toApiFlagConfig(config) });
  },
);

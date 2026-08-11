import { jsonValueSchema, targetingRulesSchema } from "@betterflag/core";
import type { FlagConfigRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { getEnvironmentBySlug, getFlagInOrg } from "@/lib/db";
import { parseJson, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { rebuildAndPushSnapshot } from "@/lib/sync";

export const runtime = "nodejs";

const updateConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    rolloutPct: z.number().int().min(0).max(100).optional(),
    rules: targetingRulesSchema.optional(),
    valueOn: jsonValueSchema.optional(),
    valueOff: jsonValueSchema.optional(),
    clearKill: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const PUT = withErrors<{ id: string; env: string }>(
  async (request: NextRequest, { params }) => {
    const { id, env: envSlug } = await params;
    const actor = await resolveActor(request);
    const body = await parseJson(request, updateConfigSchema);
    const service = createServiceClient();

    const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
    assertKeyScope(actor, project.id);
    await assertOrgWritable(service, actor.orgId);
    const environment = await getEnvironmentBySlug(service, project.id, envSlug);

    const audit = auditActor(actor);
    const config = unwrap(
      await service.rpc("update_flag_config", {
        p_flag: flag.id,
        p_environment: environment.id,
        p_enabled: body.enabled ?? null,
        p_rollout_pct: body.rolloutPct ?? null,
        p_rules: body.rules ?? null,
        p_value_on: body.valueOn ?? null,
        p_value_off: body.valueOff ?? null,
        p_clear_kill: body.clearKill ?? null,
        p_expected_version: body.expectedVersion ?? null,
        p_actor_type: audit.actorType,
        p_actor_id: audit.actorId,
        p_actor_key_prefix: audit.actorKeyPrefix,
      }),
    ) as FlagConfigRow;

    // Same fast path as kill: write KV now so enable/rollout land in seconds,
    // then enqueue sync for reconciliation (queue alone can take minutes).
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

import { targetingRulesSchema } from "@shipos/core";
import type { FlagConfigRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { enqueueConfigSync } from "@/lib/cloudflare";
import { getEnvironmentBySlug, getFlagConfig, getFlagInOrg } from "@/lib/db";
import { HttpError, parseJson, unwrap, withErrors } from "@/lib/errors";
import {
  checkGuardrail,
  stageApproval,
  type StagedAction,
  type StagedPatch,
} from "@/lib/guardrails";
import { createServiceClient } from "@/lib/supabase/server";

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

    if (body.fromEnv === envSlug) {
      throw new HttpError(400, "invalid_promote", "Source and target environments are the same");
    }

    const target = await getEnvironmentBySlug(service, project.id, envSlug);
    const source = await getEnvironmentBySlug(service, project.id, body.fromEnv);
    const sourceConfig = await getFlagConfig(service, flag.id, source.id);

    // Values copied from the source env. Snapshot semantics: what was
    // reviewed at stage time is exactly what an approval replays.
    const parsedRules = targetingRulesSchema.safeParse(sourceConfig.rules);
    const patch: StagedPatch = {
      enabled: sourceConfig.enabled,
      rolloutPct: sourceConfig.rollout_pct,
      ...(parsedRules.success ? { rules: parsedRules.data } : {}),
      ...(sourceConfig.value_on !== null ? { valueOn: sourceConfig.value_on } : {}),
      ...(sourceConfig.value_off !== null ? { valueOff: sourceConfig.value_off } : {}),
    };

    // Guardrail: agents promoting into prod may need human sign-off.
    if (
      actor.type === "agent" &&
      target.slug === "prod" &&
      (await checkGuardrail(service, actor.orgId, target.id, "promote_prod"))
    ) {
      const staged: StagedAction = {
        action: "promote",
        flagId: flag.id,
        flagKey: flag.key,
        projectId: project.id,
        environmentId: target.id,
        envSlug: target.slug,
        patch,
        fromEnvSlug: source.slug,
      };
      const approval = await stageApproval(service, {
        orgId: actor.orgId,
        projectId: project.id,
        requestedByKey: actor.keyPrefix,
        action: staged,
      });
      return NextResponse.json(
        {
          approvalRequired: true,
          approvalId: approval.id,
          message:
            `Promoting "${flag.key}" from ${source.slug} to ${target.slug} requires human ` +
            `approval (guardrail: promote_prod). Nothing has changed yet — the ${source.slug} ` +
            `config was captured and staged as approval ${approval.id}. An org owner or admin ` +
            `can approve it on the Approvals page or via ` +
            `POST /api/v1/approvals/${approval.id}/approve. Poll GET /api/v1/approvals?status=pending.`,
        },
        { status: 202 },
      );
    }

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

    enqueueConfigSync({
      projectId: project.id,
      environmentId: target.id,
      envSlug: target.slug,
      orgId: actor.orgId,
    });

    return NextResponse.json({ config: toApiFlagConfig(config) });
  },
);

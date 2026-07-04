import { jsonValueSchema, targetingRulesSchema } from "@shipos/core";
import type { FlagConfigRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { enqueueConfigSync } from "@/lib/cloudflare";
import { getEnvironmentBySlug, getFlagInOrg } from "@/lib/db";
import { parseJson, unwrap, withErrors } from "@/lib/errors";
import { checkGuardrail, stageApproval, type StagedAction } from "@/lib/guardrails";
import { createServiceClient } from "@/lib/supabase/server";

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
    const environment = await getEnvironmentBySlug(service, project.id, envSlug);

    // Guardrail: agents ramping a flag to 100% may need human sign-off.
    if (
      actor.type === "agent" &&
      body.rolloutPct === 100 &&
      (await checkGuardrail(service, actor.orgId, environment.id, "rollout_100"))
    ) {
      const staged: StagedAction = {
        action: "update_flag_config",
        flagId: flag.id,
        flagKey: flag.key,
        projectId: project.id,
        environmentId: environment.id,
        envSlug: environment.slug,
        patch: body,
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
            `Rolling "${flag.key}" to 100% in ${environment.slug} requires human approval ` +
            `(guardrail: rollout_100). Nothing has changed yet. Approval ${approval.id} is ` +
            `pending — an org owner or admin can approve it on the Approvals page or via ` +
            `POST /api/v1/approvals/${approval.id}/approve. Poll GET /api/v1/approvals?status=pending.`,
        },
        { status: 202 },
      );
    }

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

    enqueueConfigSync({
      projectId: project.id,
      environmentId: environment.id,
      envSlug: environment.slug,
      orgId: actor.orgId,
    });

    return NextResponse.json({ config: toApiFlagConfig(config) });
  },
);

import type { FlagConfigRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { countOwnersAndAdmins, getEnvironmentBySlug, getFlagInOrg } from "@/lib/db";
import { unwrap, withErrors } from "@/lib/errors";
import { checkGuardrail, stageApproval, type StagedAction } from "@/lib/guardrails";
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

    // Guardrail: agent-triggered kill switches may need a human hand on the lever.
    if (
      actor.type === "agent" &&
      (await checkGuardrail(service, actor.orgId, environment.id, "kill_switch"))
    ) {
      const staged: StagedAction = {
        action: "kill_flag",
        flagId: flag.id,
        flagKey: flag.key,
        projectId: project.id,
        environmentId: environment.id,
        envSlug: environment.slug,
      };
      const approval = await stageApproval(service, {
        orgId: actor.orgId,
        projectId: project.id,
        requestedByKey: actor.keyPrefix,
        action: staged,
      });
      const approverCount = await countOwnersAndAdmins(service, actor.orgId);
      return NextResponse.json(
        {
          approvalRequired: true,
          approvalId: approval.id,
          message:
            `Kill switch for "${flag.key}" in ${environment.slug} was staged, NOT executed — ` +
            `this org's guardrails require human approval for kill_switch. The flag is still ` +
            `serving its current config. Approval ${approval.id} is pending; any of the ` +
            `${approverCount} org owner${approverCount === 1 ? "" : "s"}/admin${approverCount === 1 ? "" : "s"} ` +
            `can approve it on the Approvals page or via POST /api/v1/approvals/${approval.id}/approve. ` +
            `Poll GET /api/v1/approvals?status=pending to see when it resolves. If this is urgent, ` +
            `tell a human now.`,
        },
        { status: 202 },
      );
    }

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

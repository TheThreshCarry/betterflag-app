import type { ApprovalRow, FlagConfigRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiApproval, toApiFlagConfig } from "@/lib/api-types";
import { auditActor, requireOwnerOrAdmin, resolveActor } from "@/lib/auth";
import { enqueueConfigSync } from "@/lib/cloudflare";
import { getFlagInOrg, recordAudit } from "@/lib/db";
import { HttpError, unwrap, withErrors } from "@/lib/errors";
import { stagedActionSchema, type StagedAction } from "@/lib/guardrails";
import { createServiceClient } from "@/lib/supabase/server";
import { rebuildAndPushSnapshot } from "@/lib/sync";

export const runtime = "nodejs";

async function loadPendingApproval(
  service: ReturnType<typeof createServiceClient>,
  approvalId: string,
  orgId: string,
): Promise<ApprovalRow> {
  const { data, error } = await service
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  const approval = data as ApprovalRow | null;
  if (!approval) throw new HttpError(404, "approval_not_found", "Approval not found");
  if (approval.status !== "pending") {
    throw new HttpError(
      409,
      "approval_not_pending",
      `This approval was already ${approval.status}`,
    );
  }
  return approval;
}

export const POST = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  requireOwnerOrAdmin(actor);
  const service = createServiceClient();

  const approval = await loadPendingApproval(service, id, actor.orgId);
  const staged: StagedAction = stagedActionSchema.parse(approval.action);

  // The flag must still exist in this org before we replay anything.
  const { flag, project } = await getFlagInOrg(service, staged.flagId, actor.orgId);

  // Replay the staged mutation. The config change is attributed to the
  // requesting agent key (it authored the change); the approval itself is
  // attributed to the human below — so audit answers both "who did it" and
  // "who signed off".
  let config: FlagConfigRow;
  if (staged.action === "kill_flag") {
    config = unwrap(
      await service.rpc("kill_flag", {
        p_flag: staged.flagId,
        p_environment: staged.environmentId,
        p_actor_type: "agent",
        p_actor_id: null,
        p_actor_key_prefix: approval.requested_by_key,
      }),
    ) as FlagConfigRow;
  } else {
    const patch = staged.patch ?? {};
    config = unwrap(
      await service.rpc("update_flag_config", {
        p_flag: staged.flagId,
        p_environment: staged.environmentId,
        p_enabled: patch.enabled ?? null,
        p_rollout_pct: patch.rolloutPct ?? null,
        p_rules: patch.rules ?? null,
        p_value_on: patch.valueOn ?? null,
        p_value_off: patch.valueOff ?? null,
        p_clear_kill: patch.clearKill ?? null,
        p_expected_version: patch.expectedVersion ?? null,
        p_actor_type: "agent",
        p_actor_id: null,
        p_actor_key_prefix: approval.requested_by_key,
      }),
    ) as FlagConfigRow;
  }

  const resolved = unwrap(
    await service
      .from("approvals")
      .update({
        status: "approved",
        resolved_by: actor.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("*")
      .single(),
  ) as ApprovalRow;

  await recordAudit(service, {
    orgId: actor.orgId,
    projectId: project.id,
    actor: auditActor(actor),
    action: "approval.approve",
    subject: `approval:${approval.id}`,
    before: staged,
    after: { status: "approved", flagKey: flag.key, envSlug: staged.envSlug },
  });

  // Sync: kills take the synchronous KV fast path, everything else enqueues.
  if (staged.action === "kill_flag") {
    await rebuildAndPushSnapshot(
      service,
      staged.projectId,
      staged.environmentId,
      staged.envSlug,
      actor.orgId,
    );
  } else {
    enqueueConfigSync({
      projectId: staged.projectId,
      environmentId: staged.environmentId,
      envSlug: staged.envSlug,
      orgId: actor.orgId,
    });
  }

  return NextResponse.json({
    approval: toApiApproval(resolved),
    config: toApiFlagConfig(config),
  });
});

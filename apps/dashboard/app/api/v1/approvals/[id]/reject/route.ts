import type { ApprovalRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiApproval } from "@/lib/api-types";
import { auditActor, requireOwnerOrAdmin, resolveActor } from "@/lib/auth";
import { recordAudit } from "@/lib/db";
import { HttpError, unwrap, withErrors } from "@/lib/errors";
import { stagedActionSchema } from "@/lib/guardrails";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const POST = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  requireOwnerOrAdmin(actor);
  const service = createServiceClient();

  const { data, error } = await service
    .from("approvals")
    .select("*")
    .eq("id", id)
    .eq("org_id", actor.orgId)
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

  const resolved = unwrap(
    await service
      .from("approvals")
      .update({
        status: "rejected",
        resolved_by: actor.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("*")
      .single(),
  ) as ApprovalRow;

  const parsed = stagedActionSchema.safeParse(approval.action);
  await recordAudit(service, {
    orgId: actor.orgId,
    projectId: parsed.success ? parsed.data.projectId : null,
    actor: auditActor(actor),
    action: "approval.reject",
    subject: `approval:${approval.id}`,
    before: approval.action,
    after: { status: "rejected" },
  });

  return NextResponse.json({ approval: toApiApproval(resolved) });
});

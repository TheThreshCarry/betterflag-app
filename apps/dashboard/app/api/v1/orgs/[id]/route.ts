/**
 * PATCH /api/v1/orgs/:id — session-only org updates. Today that is exactly
 * one thing: picking the plan tier during onboarding (or from settings)
 * BEFORE any Polar subscription exists. The org keeps its trial state
 * (subscription_status stays null, trial_ends_at governs access); the chosen
 * tier drives PLAN_LIMITS and what the trial converts into at checkout.
 *
 * Once a Polar subscription exists, plan changes must go through checkout /
 * Polar (synced back by shipos-webhooks), so this endpoint rejects with 409.
 */
import type { OrgMemberRow, OrgRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiOrg } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { getOrg, recordAudit } from "@/lib/db";
import { HttpError, parseJson, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const patchOrgSchema = z.object({
  plan: z.enum(["starter", "launch", "scale"]),
});

export const PATCH = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const header = request.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "session_required", "Org endpoints require a signed-in session");
  }
  const { id: orgId } = await params;
  const { userId } = await resolveSessionUser();
  const body = await parseJson(request, patchOrgSchema);
  const service = createServiceClient();

  const membership = unwrap(
    await service
      .from("org_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle(),
  ) as OrgMemberRow | null;
  if (!membership) throw new HttpError(404, "org_not_found", "Organization not found");
  if (membership.role === "member") {
    throw new HttpError(403, "forbidden", "Only owners and admins can change the plan");
  }

  const org = await getOrg(service, orgId);
  if (org.polar_subscription_id !== null) {
    throw new HttpError(
      409,
      "subscription_exists",
      "This org has a billing subscription; change plans from the Settings page checkout",
    );
  }
  const before = org.plan;

  const updated = unwrap(
    await service.from("orgs").update({ plan: body.plan }).eq("id", orgId).select("*").single(),
  ) as OrgRow;

  await recordAudit(service, {
    orgId,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "org.plan_select",
    subject: `org:${orgId}`,
    before: { plan: before },
    after: { plan: updated.plan },
  });

  return NextResponse.json({ org: toApiOrg(updated, membership.role) });
});

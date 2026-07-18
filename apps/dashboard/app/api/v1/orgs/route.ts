/**
 * Onboarding-only endpoints, session auth ONLY (no API keys): creating an
 * org is the single mutation that does not go through a Postgres RPC -
 * org insert + owner membership + audit with the service client.
 */

import type { OrgMemberRow, OrgRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/allowlist";
import { toApiOrg, type ApiOrgMember } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { recordAudit } from "@/lib/db";
import { HttpError, parseJson, parseQuery, unwrap, withErrors } from "@/lib/errors";
import { triggerWelcomeSequence } from "@/lib/lifecycle";
import { captureServer } from "@/lib/posthog-server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function rejectBearer(request: NextRequest): void {
  const header = request.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "session_required", "Org endpoints require a signed-in session");
  }
}

const orgsQuerySchema = z.object({
  members: z.string().optional(),
});

export const GET = withErrors(async (request: NextRequest) => {
  rejectBearer(request);
  const { userId } = await resolveSessionUser();
  const includeMembers =
    parseQuery(request, orgsQuerySchema.passthrough()).members === "1";
  const service = createServiceClient();

  const memberships = unwrap(
    await service
      .from("org_members")
      .select("*, orgs(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ) as (OrgMemberRow & { orgs: OrgRow })[];

  const orgs = await Promise.all(
    memberships.map(async (membership) => {
      if (!includeMembers) return toApiOrg(membership.orgs, membership.role);

      const memberRows = unwrap(
        await service
          .from("org_members")
          .select("*")
          .eq("org_id", membership.org_id)
          .order("created_at", { ascending: true }),
      ) as OrgMemberRow[];

      const members: ApiOrgMember[] = await Promise.all(
        memberRows.map(async (member) => {
          let email: string | null = null;
          try {
            const { data } = await service.auth.admin.getUserById(member.user_id);
            email = data.user?.email ?? null;
          } catch {
            // Email resolution is best-effort; the member list still renders.
          }
          return {
            userId: member.user_id,
            role: member.role,
            email,
            createdAt: member.created_at,
          };
        }),
      );

      return toApiOrg(membership.orgs, membership.role, members);
    }),
  );

  return NextResponse.json({ orgs });
});

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
});

export const POST = withErrors(async (request: NextRequest) => {
  rejectBearer(request);
  const { userId, email } = await resolveSessionUser();

  // Private alpha: only allowlisted emails can create an org (existing
  // members never hit this path, they already have an org).
  if (!(await isAllowedEmail(email))) {
    throw new HttpError(
      403,
      "alpha_access_required",
      "ShipOS is in private alpha; this email hasn't been admitted yet",
    );
  }

  const body = await parseJson(request, createOrgSchema);
  const service = createServiceClient();

  const org = unwrap(
    await service.from("orgs").insert({ name: body.name }).select("*").single(),
  ) as OrgRow;

  const { error: memberError } = await service
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "owner" });
  if (memberError) throw memberError;

  await recordAudit(service, {
    orgId: org.id,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "org.create",
    subject: `org:${org.id}`,
    after: { id: org.id, name: org.name, plan: org.plan },
  });

  // Kick off the welcome email sequence (best-effort, never fails the request).
  if (email) {
    await triggerWelcomeSequence({ orgId: org.id, email, orgName: org.name });
  }

  await captureServer({
    distinctId: userId,
    event: "onboarding_org_created",
    properties: { orgId: org.id, orgName: org.name, plan: org.plan },
    groups: { organization: org.id },
  });

  return NextResponse.json({ org: toApiOrg(org, "owner") }, { status: 201 });
});

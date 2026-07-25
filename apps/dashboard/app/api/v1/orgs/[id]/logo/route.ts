/**
 * POST /api/v1/orgs/:id/logo — upload org logo (multipart file field).
 * DELETE /api/v1/orgs/:id/logo — clear org logo.
 * Session-only; owner/admin + assertOrgWritable.
 */
import type { OrgMemberRow, OrgRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiOrg } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { getOrg, recordAudit } from "@/lib/db";
import { HttpError, unwrap, withErrors } from "@/lib/errors";
import { parseMediaUpload, requireSessionOnly } from "@/lib/media-upload";
import {
  deleteMediaObject,
  keyFromPublicUrl,
  orgLogoKey,
  putPublicImage,
} from "@/lib/r2";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireOrgAdmin(orgId: string, userId: string) {
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
    throw new HttpError(403, "forbidden", "Only owners and admins can change the logo");
  }
  await assertOrgWritable(service, orgId);
  return { service, membership };
}

export const POST = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  requireSessionOnly(request);
  const { id: orgId } = await params;
  const { userId } = await resolveSessionUser();
  const { service, membership } = await requireOrgAdmin(orgId, userId);
  const file = await parseMediaUpload(request);
  const org = await getOrg(service, orgId);

  const key = orgLogoKey(orgId, file.ext);
  const previousKey = keyFromPublicUrl(org.logo_url);
  const logoUrl = await putPublicImage({
    key,
    body: file.buffer,
    contentType: file.contentType,
  });

  if (previousKey && previousKey !== key) {
    await deleteMediaObject(previousKey);
  }

  const updated = unwrap(
    await service
      .from("orgs")
      .update({ logo_url: logoUrl })
      .eq("id", orgId)
      .select("*")
      .single(),
  ) as OrgRow;

  await recordAudit(service, {
    orgId,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "org.logo_set",
    subject: `org:${orgId}`,
    before: { logoUrl: org.logo_url },
    after: { logoUrl: updated.logo_url },
  });

  return NextResponse.json({ org: toApiOrg(updated, membership.role) });
});

export const DELETE = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  requireSessionOnly(request);
  const { id: orgId } = await params;
  const { userId } = await resolveSessionUser();
  const { service, membership } = await requireOrgAdmin(orgId, userId);
  const org = await getOrg(service, orgId);

  const previousKey = keyFromPublicUrl(org.logo_url);
  if (previousKey) await deleteMediaObject(previousKey);

  const updated = unwrap(
    await service
      .from("orgs")
      .update({ logo_url: null })
      .eq("id", orgId)
      .select("*")
      .single(),
  ) as OrgRow;

  await recordAudit(service, {
    orgId,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "org.logo_clear",
    subject: `org:${orgId}`,
    before: { logoUrl: org.logo_url },
    after: { logoUrl: null },
  });

  return NextResponse.json({ org: toApiOrg(updated, membership.role) });
});

/**
 * POST /api/v1/projects/:id/picture — upload project picture (multipart file).
 * DELETE /api/v1/projects/:id/picture — clear project picture.
 * Session-only; owner/admin + assertOrgWritable.
 */
import type { OrgMemberRow, ProjectRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiProject } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { getProjectInOrg, listEnvironments, recordAudit } from "@/lib/db";
import { HttpError, unwrap, withErrors } from "@/lib/errors";
import { parseMediaUpload, requireSessionOnly } from "@/lib/media-upload";
import {
  deleteMediaObject,
  keyFromPublicUrl,
  projectPictureKey,
  putPublicImage,
} from "@/lib/r2";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireProjectAdmin(projectId: string, userId: string) {
  const service = createServiceClient();
  // Resolve membership via project's org.
  const projectLookup = unwrap(
    await service.from("projects").select("*").eq("id", projectId).maybeSingle(),
  ) as ProjectRow | null;
  if (!projectLookup) throw new HttpError(404, "project_not_found", "Project not found");

  const membership = unwrap(
    await service
      .from("org_members")
      .select("*")
      .eq("org_id", projectLookup.org_id)
      .eq("user_id", userId)
      .maybeSingle(),
  ) as OrgMemberRow | null;
  if (!membership) throw new HttpError(404, "project_not_found", "Project not found");
  if (membership.role === "member") {
    throw new HttpError(403, "forbidden", "Only owners and admins can change the picture");
  }
  await assertOrgWritable(service, projectLookup.org_id);
  const project = await getProjectInOrg(service, projectId, projectLookup.org_id);
  return { service, membership, project };
}

export const POST = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  requireSessionOnly(request);
  const { id: projectId } = await params;
  const { userId } = await resolveSessionUser();
  const { service, project } = await requireProjectAdmin(projectId, userId);
  const file = await parseMediaUpload(request);

  const key = projectPictureKey(projectId, file.ext);
  const previousKey = keyFromPublicUrl(project.picture_url);
  const pictureUrl = await putPublicImage({
    key,
    body: file.buffer,
    contentType: file.contentType,
  });

  if (previousKey && previousKey !== key) {
    await deleteMediaObject(previousKey);
  }

  const updated = unwrap(
    await service
      .from("projects")
      .update({ picture_url: pictureUrl })
      .eq("id", projectId)
      .select("*")
      .single(),
  ) as ProjectRow;

  await recordAudit(service, {
    orgId: project.org_id,
    projectId,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "project.picture_set",
    subject: `project:${project.slug}`,
    before: { pictureUrl: project.picture_url },
    after: { pictureUrl: updated.picture_url },
  });

  const environments = await listEnvironments(service, projectId);
  return NextResponse.json({ project: toApiProject(updated, environments) });
});

export const DELETE = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  requireSessionOnly(request);
  const { id: projectId } = await params;
  const { userId } = await resolveSessionUser();
  const { service, project } = await requireProjectAdmin(projectId, userId);

  const previousKey = keyFromPublicUrl(project.picture_url);
  if (previousKey) await deleteMediaObject(previousKey);

  const updated = unwrap(
    await service
      .from("projects")
      .update({ picture_url: null })
      .eq("id", projectId)
      .select("*")
      .single(),
  ) as ProjectRow;

  await recordAudit(service, {
    orgId: project.org_id,
    projectId,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "project.picture_clear",
    subject: `project:${project.slug}`,
    before: { pictureUrl: project.picture_url },
    after: { pictureUrl: null },
  });

  const environments = await listEnvironments(service, projectId);
  return NextResponse.json({ project: toApiProject(updated, environments) });
});

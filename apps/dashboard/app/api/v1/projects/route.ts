import { PLAN_LIMITS, type EnvironmentRow, type ProjectRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiProject } from "@/lib/api-types";
import { auditActor, resolveActor } from "@/lib/auth";
import { enqueueConfigSync } from "@/lib/cloudflare";
import { getOrg, listEnvironments } from "@/lib/db";
import { HttpError, parseJson, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const service = createServiceClient();

  const rows = unwrap(
    await service
      .from("projects")
      .select("*, environments(*)")
      .eq("org_id", actor.orgId)
      .order("created_at", { ascending: true }),
  ) as (ProjectRow & { environments: EnvironmentRow[] })[];

  return NextResponse.json({
    projects: rows.map((row) => {
      const { environments, ...project } = row;
      return toApiProject(
        project as ProjectRow,
        [...environments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      );
    }),
  });
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "slug must be lowercase letters, digits and dashes"),
});

export const POST = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const body = await parseJson(request, createProjectSchema);
  const service = createServiceClient();

  const org = await getOrg(service, actor.orgId);
  const limit = PLAN_LIMITS[org.plan].projects;
  if (limit !== null) {
    const { count, error } = await service
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("org_id", actor.orgId);
    if (error) throw error;
    if ((count ?? 0) >= limit) {
      throw new HttpError(
        403,
        "plan_limit",
        `The ${org.plan} plan includes ${limit} project${limit === 1 ? "" : "s"}. Upgrade to add more.`,
      );
    }
  }

  const audit = auditActor(actor);
  const project = unwrap(
    await service.rpc("create_project_with_envs", {
      p_org: actor.orgId,
      p_name: body.name,
      p_slug: body.slug,
      p_actor_type: audit.actorType,
      p_actor_id: audit.actorId,
      p_actor_key_prefix: audit.actorKeyPrefix,
    }),
  ) as ProjectRow;

  const environments = await listEnvironments(service, project.id);
  for (const env of environments) {
    enqueueConfigSync({
      projectId: project.id,
      environmentId: env.id,
      envSlug: env.slug,
      orgId: actor.orgId,
    });
  }

  return NextResponse.json({ project: toApiProject(project, environments) }, { status: 201 });
});

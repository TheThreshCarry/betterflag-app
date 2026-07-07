import type { FlagRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiEnvironment, toApiFlag, toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { enqueueConfigSync } from "@/lib/cloudflare";
import { getFlagInOrg, listEnvironments, listFlagConfigs, recordAudit } from "@/lib/db";
import { parseJson, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const GET = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  const service = createServiceClient();

  const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
  assertKeyScope(actor, project.id);

  const [configs, environments] = await Promise.all([
    listFlagConfigs(service, flag.id),
    listEnvironments(service, project.id),
  ]);
  const envById = new Map(environments.map((env) => [env.id, env]));

  return NextResponse.json({
    flag: toApiFlag(flag),
    project: { id: project.id, name: project.name, slug: project.slug },
    configs: configs.map((config) => {
      const env = envById.get(config.environment_id);
      return {
        ...toApiFlagConfig(config),
        ...(env ? { environment: toApiEnvironment(env) } : {}),
      };
    }),
  });
});

const patchFlagSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
  })
  .refine((body) => body.name !== undefined || body.description !== undefined, {
    message: "Provide name and/or description",
  });

export const PATCH = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  const body = await parseJson(request, patchFlagSchema);
  const service = createServiceClient();
  await assertOrgWritable(service, actor.orgId);

  const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
  assertKeyScope(actor, project.id);

  const updates: { name?: string; description?: string } = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  const updated = unwrap(
    await service.from("flags").update(updates).eq("id", flag.id).select("*").single(),
  ) as FlagRow;

  await recordAudit(service, {
    orgId: actor.orgId,
    projectId: project.id,
    actor: auditActor(actor),
    action: "flag.update",
    subject: `flag:${flag.key}`,
    before: flag,
    after: updated,
  });

  return NextResponse.json({ flag: toApiFlag(updated) });
});

export const DELETE = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  const service = createServiceClient();

  const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
  assertKeyScope(actor, project.id);
  await assertOrgWritable(service, actor.orgId);

  if (flag.archived_at !== null) {
    return NextResponse.json({ flag: toApiFlag(flag) });
  }

  const archived = unwrap(
    await service
      .from("flags")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", flag.id)
      .select("*")
      .single(),
  ) as FlagRow;

  await recordAudit(service, {
    orgId: actor.orgId,
    projectId: project.id,
    actor: auditActor(actor),
    action: "flag.archive",
    subject: `flag:${flag.key}`,
    before: flag,
    after: archived,
  });

  // Archived flags drop out of snapshots — resync every environment.
  const environments = await listEnvironments(service, project.id);
  for (const env of environments) {
    enqueueConfigSync({
      projectId: project.id,
      environmentId: env.id,
      envSlug: env.slug,
      orgId: actor.orgId,
    });
  }

  return NextResponse.json({ flag: toApiFlag(archived) });
});

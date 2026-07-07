import { flagKeySchema, flagKindSchema, jsonValueSchema, type JsonValue } from "@shipos/core";
import type { FlagConfigRow, FlagRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiFlag, toApiFlagConfig } from "@/lib/api-types";
import { assertKeyScope, auditActor, resolveActor } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { enqueueConfigSync } from "@/lib/cloudflare";
import { getProjectInOrg, listEnvironments } from "@/lib/db";
import { parseJson, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const GET = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  const service = createServiceClient();

  const project = await getProjectInOrg(service, id, actor.orgId);
  assertKeyScope(actor, project.id);

  const keyFilter = new URL(request.url).searchParams.get("key");
  let query = service
    .from("flags")
    .select("*, flag_configs(*)")
    .eq("project_id", project.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (keyFilter) query = query.eq("key", keyFilter);

  const rows = unwrap(await query) as (FlagRow & { flag_configs: FlagConfigRow[] })[];

  return NextResponse.json({
    flags: rows.map((row) => {
      const { flag_configs: configs, ...flag } = row;
      return { ...toApiFlag(flag as FlagRow), configs: configs.map(toApiFlagConfig) };
    }),
  });
});

function defaultValueForKind(kind: "boolean" | "string" | "number" | "json"): JsonValue {
  switch (kind) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "number":
      return 0;
    case "json":
      return null;
  }
}

const createFlagSchema = z.object({
  key: flagKeySchema,
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  kind: flagKindSchema,
  defaultValue: jsonValueSchema.optional(),
});

export const POST = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  const body = await parseJson(request, createFlagSchema);
  const service = createServiceClient();
  await assertOrgWritable(service, actor.orgId);

  const project = await getProjectInOrg(service, id, actor.orgId);
  assertKeyScope(actor, project.id);

  const audit = auditActor(actor);
  const flag = unwrap(
    await service.rpc("create_flag_with_configs", {
      p_project: project.id,
      p_key: body.key,
      p_name: body.name,
      p_description: body.description ?? "",
      p_kind: body.kind,
      p_default_value: body.defaultValue ?? defaultValueForKind(body.kind),
      p_actor_type: audit.actorType,
      p_actor_id: audit.actorId,
      p_actor_key_prefix: audit.actorKeyPrefix,
    }),
  ) as FlagRow;

  const environments = await listEnvironments(service, project.id);
  for (const env of environments) {
    enqueueConfigSync({
      projectId: project.id,
      environmentId: env.id,
      envSlug: env.slug,
      orgId: actor.orgId,
    });
  }

  return NextResponse.json({ flag: toApiFlag(flag) }, { status: 201 });
});

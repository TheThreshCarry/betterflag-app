import { flagKeySchema } from "@betterflag/core";
import type { FlagRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiEnvironment, toApiFlag, toApiFlagConfig, toApiProject } from "@/lib/api-types";
import { assertKeyScope, resolveActor } from "@/lib/auth";
import { getProjectBySlug, listEnvironments, listFlagConfigs } from "@/lib/db";
import { HttpError, parseQuery, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const lookupSchema = z.object({
  projectSlug: z.string().min(1),
  key: flagKeySchema,
});

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const { projectSlug, key } = parseQuery(request, lookupSchema.passthrough()) as z.infer<
    typeof lookupSchema
  >;
  const service = createServiceClient();

  const project = await getProjectBySlug(service, projectSlug, actor.orgId);
  if (!project) {
    throw new HttpError(404, "flag_not_found", `No project "${projectSlug}" in this organization`);
  }
  assertKeyScope(actor, project.id);

  const { data, error } = await service
    .from("flags")
    .select("*")
    .eq("project_id", project.id)
    .eq("key", key)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  const flag = data as FlagRow | null;
  if (!flag) {
    throw new HttpError(404, "flag_not_found", `No flag "${key}" in project "${projectSlug}"`);
  }

  const [configs, environments] = await Promise.all([
    listFlagConfigs(service, flag.id),
    listEnvironments(service, project.id),
  ]);
  const envById = new Map(environments.map((env) => [env.id, env]));

  return NextResponse.json({
    project: toApiProject(project, environments),
    flag: toApiFlag(flag),
    configs: configs.map((config) => {
      const env = envById.get(config.environment_id);
      return {
        ...toApiFlagConfig(config),
        ...(env ? { environment: toApiEnvironment(env) } : {}),
      };
    }),
  });
});

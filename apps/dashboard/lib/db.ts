/**
 * Small typed lookups shared by the /api/v1 route handlers. All reads use
 * the service client and enforce org scoping in code (bearer actors have no
 * RLS context).
 */

import type {
  EnvironmentRow,
  FlagConfigRow,
  FlagRow,
  OrgRow,
  ProfileRow,
  ProjectRow,
} from "@shipos/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuditActorFields } from "./auth";
import { HttpError, unwrap } from "./errors";

/** Ensure a profiles row exists (covers users created before the migration trigger). */
export async function getOrCreateProfile(
  service: SupabaseClient,
  userId: string,
): Promise<ProfileRow> {
  const existing = unwrap(
    await service.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ) as ProfileRow | null;
  if (existing) return existing;

  const created = unwrap(
    await service
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" })
      .select("*")
      .single(),
  ) as ProfileRow;
  return created;
}

export async function getOrg(service: SupabaseClient, orgId: string): Promise<OrgRow> {
  const { data, error } = await service.from("orgs").select("*").eq("id", orgId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "org_not_found", "Organization not found");
  return data as OrgRow;
}

export async function getProjectInOrg(
  service: SupabaseClient,
  projectId: string,
  orgId: string,
): Promise<ProjectRow> {
  const { data, error } = await service
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "project_not_found", "Project not found");
  return data as ProjectRow;
}

export async function getProjectBySlug(
  service: SupabaseClient,
  slug: string,
  orgId: string,
): Promise<ProjectRow | null> {
  const { data, error } = await service
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectRow | null) ?? null;
}

export async function getFlagInOrg(
  service: SupabaseClient,
  flagId: string,
  orgId: string,
): Promise<{ flag: FlagRow; project: ProjectRow }> {
  const { data, error } = await service
    .from("flags")
    .select("*, projects!inner(*)")
    .eq("id", flagId)
    .maybeSingle();
  if (error) throw error;

  const row = data as (FlagRow & { projects: ProjectRow }) | null;
  if (!row || row.projects.org_id !== orgId) {
    throw new HttpError(404, "flag_not_found", "Flag not found");
  }
  const { projects: project, ...flag } = row;
  return { flag: flag as FlagRow, project };
}

export async function listEnvironments(
  service: SupabaseClient,
  projectId: string,
): Promise<EnvironmentRow[]> {
  return unwrap(
    await service
      .from("environments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ) as EnvironmentRow[];
}

export async function getEnvironmentBySlug(
  service: SupabaseClient,
  projectId: string,
  envSlug: string,
): Promise<EnvironmentRow> {
  const { data, error } = await service
    .from("environments")
    .select("*")
    .eq("project_id", projectId)
    .eq("slug", envSlug)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new HttpError(404, "environment_not_found", `No environment "${envSlug}" in this project`);
  }
  return data as EnvironmentRow;
}

export async function getEnvironmentInProject(
  service: SupabaseClient,
  environmentId: string,
  projectId: string,
): Promise<EnvironmentRow> {
  const { data, error } = await service
    .from("environments")
    .select("*")
    .eq("id", environmentId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "environment_not_found", "Environment not found");
  return data as EnvironmentRow;
}

export async function listFlagConfigs(
  service: SupabaseClient,
  flagId: string,
): Promise<FlagConfigRow[]> {
  return unwrap(
    await service.from("flag_configs").select("*").eq("flag_id", flagId),
  ) as FlagConfigRow[];
}

export async function getFlagConfig(
  service: SupabaseClient,
  flagId: string,
  environmentId: string,
): Promise<FlagConfigRow> {
  const { data, error } = await service
    .from("flag_configs")
    .select("*")
    .eq("flag_id", flagId)
    .eq("environment_id", environmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "config_not_found", "Flag config not found");
  return data as FlagConfigRow;
}

export async function countOwnersAndAdmins(
  service: SupabaseClient,
  orgId: string,
): Promise<number> {
  const { count, error } = await service
    .from("org_members")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"]);
  if (error) throw error;
  return count ?? 0;
}

/** Record an audit row via the record_audit RPC (the ONE audit write path). */
export async function recordAudit(
  service: SupabaseClient,
  input: {
    orgId: string;
    projectId?: string | null;
    actor: AuditActorFields;
    action: string;
    subject: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  const { error } = await service.rpc("record_audit", {
    p_org: input.orgId,
    p_project: input.projectId ?? null,
    p_actor_type: input.actor.actorType,
    p_actor_id: input.actor.actorId,
    p_actor_key_prefix: input.actor.actorKeyPrefix,
    p_action: input.action,
    p_subject: input.subject,
    p_before: input.before ?? null,
    p_after: input.after ?? null,
  });
  if (error) throw error;
}

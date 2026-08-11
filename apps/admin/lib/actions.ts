"use server";

/**
 * Super-admin mutations. Every action re-checks requireAdmin() (the page
 * gate is UX; this is the boundary), does its own confirmation checks
 * server-side, and returns a plain result object so client dialogs can
 * render errors without try/catch ceremony.
 */

import { revalidatePath } from "next/cache";

import { isAdminEmail, requireAdmin } from "./admin-auth";
import { kvDeleteSdkKey, kvDeleteSnapshot } from "./cloudflare";
import { createServiceClient } from "./supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function failure(err: unknown): ActionResult {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[admin action]", message);
  return { ok: false, error: message };
}

/** Freeze/unfreeze land in the org's audit log so the tenant can see them. */
async function recordOrgAudit(
  adminId: string,
  orgId: string,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.rpc("record_audit", {
    p_org: orgId,
    p_project: null,
    p_actor_type: "user",
    p_actor_id: adminId,
    p_actor_key_prefix: null,
    p_action: action,
    p_subject: `org:${orgId}`,
    p_before: before,
    p_after: after,
  });
  if (error) throw error;
}

export async function freezeOrg(orgId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const service = createServiceClient();
    const frozenAt = new Date().toISOString();
    const { error } = await service
      .from("orgs")
      .update({ frozen_at: frozenAt })
      .eq("id", orgId)
      .is("frozen_at", null);
    if (error) throw error;
    await recordOrgAudit(admin.id, orgId, "org.freeze", { frozen_at: null }, { frozen_at: frozenAt });
    console.log(`[admin] ${admin.email} froze org ${orgId}`);
    revalidatePath("/orgs");
    revalidatePath(`/orgs/${orgId}`);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function unfreezeOrg(orgId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const service = createServiceClient();
    const { error } = await service.from("orgs").update({ frozen_at: null }).eq("id", orgId);
    if (error) throw error;
    await recordOrgAudit(admin.id, orgId, "org.unfreeze", { frozen_at: "set" }, { frozen_at: null });
    console.log(`[admin] ${admin.email} unfroze org ${orgId}`);
    revalidatePath("/orgs");
    revalidatePath(`/orgs/${orgId}`);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Hard delete: Postgres cascades take projects, environments, flags,
 * configs, keys and audit rows; edge KV snapshots and SDK key entries are
 * removed explicitly first so the edge stops serving immediately. Billing:
 * a live Polar subscription is NOT canceled here; cancel it in Polar.
 */
export async function deleteOrg(orgId: string, confirmName: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const service = createServiceClient();

    const { data: org, error: orgError } = await service
      .from("orgs")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();
    if (orgError) throw orgError;
    if (!org) return { ok: false, error: "Organization not found." };
    if (confirmName.trim() !== org.name) {
      return { ok: false, error: "Confirmation name does not match the organization name." };
    }

    const [{ data: projects, error: projectsError }, { data: keys, error: keysError }] =
      await Promise.all([
        service.from("projects").select("id, environments(slug)").eq("org_id", orgId),
        service.from("api_keys").select("prefix, kind").eq("org_id", orgId),
      ]);
    if (projectsError) throw projectsError;
    if (keysError) throw keysError;

    for (const project of (projects ?? []) as { id: string; environments: { slug: string }[] }[]) {
      for (const environment of project.environments) {
        await kvDeleteSnapshot(project.id, environment.slug);
      }
    }
    for (const key of (keys ?? []) as { prefix: string; kind: string }[]) {
      if (key.kind === "sdk") await kvDeleteSdkKey(key.prefix);
    }

    const { error: deleteError } = await service.from("orgs").delete().eq("id", orgId);
    if (deleteError) throw deleteError;

    console.log(`[admin] ${admin.email} deleted org ${orgId} (${org.name})`);
    revalidatePath("/orgs");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/** Ten years; Supabase has no permanent flag, this is the conventional max. */
const BAN_DURATION = "87600h";

async function guardTargetUser(userId: string): Promise<{ email: string | null } | ActionResult> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data.user) return { ok: false, error: "User not found." };
  if (isAdminEmail(data.user.email)) {
    return { ok: false, error: "This user is on the Betterflag admin allowlist and cannot be acted on." };
  }
  return { email: data.user.email ?? null };
}

export async function banUser(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const guard = await guardTargetUser(userId);
    if ("ok" in guard) return guard;

    const service = createServiceClient();
    const { error } = await service.auth.admin.updateUserById(userId, {
      ban_duration: BAN_DURATION,
    });
    if (error) throw error;
    console.log(`[admin] ${admin.email} banned user ${userId} (${guard.email ?? "no email"})`);
    revalidatePath("/users");
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const service = createServiceClient();
    const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (error) throw error;
    console.log(`[admin] ${admin.email} unbanned user ${userId}`);
    revalidatePath("/users");
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Deletes the auth user; org_members rows cascade. Orgs the user solely
 * owned are NOT deleted, they show up with 0 members in the orgs list.
 */
export async function deleteUser(userId: string, confirmEmail: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const guard = await guardTargetUser(userId);
    if ("ok" in guard) return guard;
    if ((guard.email ?? "").toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      return { ok: false, error: "Confirmation email does not match the user's email." };
    }

    const service = createServiceClient();
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
    console.log(`[admin] ${admin.email} deleted user ${userId} (${guard.email ?? "no email"})`);
    revalidatePath("/users");
    revalidatePath("/orgs");
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

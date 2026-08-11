/**
 * Actor resolution for the control plane API.
 *
 * Two auth modes:
 *  - Supabase session cookie (dashboard users)      → { type: 'user', ... }
 *  - `Authorization: Bearer bf_agt_*` / `bf_adm_*` → machine actors
 *
 * SDK keys (`bf_sdk_*`) are rejected on the control plane: they are
 * publishable evaluation credentials for the edge, never management keys.
 *
 * Audit attribution: session users audit as actor_type 'user'; agent AND
 * admin keys are machine keys and audit as actor_type 'agent' with their
 * key prefix.
 */

import { API_KEY_RE, keyPrefixOf, sha256Hex, timingSafeEqualHex } from "@betterflag/core";
import type { ApiKeyRow, OrgRole } from "@betterflag/db";

import { HttpError } from "./errors";
import { createServiceClient, createSessionClient } from "./supabase/server";

export type Actor =
  | { type: "user"; userId: string; orgId: string; role: OrgRole }
  | {
      type: "agent" | "admin_key";
      orgId: string;
      keyId: string;
      keyPrefix: string;
      projectId: string | null;
    };

export interface AuditActorFields {
  actorType: "user" | "agent";
  actorId: string | null;
  actorKeyPrefix: string | null;
}

/** Only session users audit as 'user'; every machine key audits as 'agent'. */
export function auditActor(actor: Actor): AuditActorFields {
  if (actor.type === "user") {
    return { actorType: "user", actorId: actor.userId, actorKeyPrefix: null };
  }
  return { actorType: "agent", actorId: null, actorKeyPrefix: actor.keyPrefix };
}

async function resolveBearerActor(token: string): Promise<Actor> {
  if (!API_KEY_RE.test(token)) {
    throw new HttpError(401, "invalid_api_key", "Malformed API key");
  }
  if (token.startsWith("bf_sdk_")) {
    throw new HttpError(
      401,
      "sdk_key_rejected",
      "SDK keys evaluate flags at the edge; use an agent (bf_agt_*) or admin (bf_adm_*) key on the control plane API",
    );
  }

  const hash = await sha256Hex(token);
  const service = createServiceClient();
  const { data, error } = await service
    .from("api_keys")
    .select("*")
    .eq("hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;

  const row = data as ApiKeyRow | null;
  if (!row || !timingSafeEqualHex(row.hash, hash)) {
    throw new HttpError(401, "invalid_api_key", "Unknown or revoked API key");
  }
  if (row.prefix !== keyPrefixOf(token)) {
    // Defense in depth: the stored prefix must match the presented key.
    throw new HttpError(401, "invalid_api_key", "Unknown or revoked API key");
  }

  // Touch last_used_at, fire-and-forget: never block the request on it.
  void service
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(({ error: touchError }) => {
      if (touchError) {
        console.warn("[auth] failed to touch api_keys.last_used_at:", touchError.message);
      }
    });

  return {
    type: row.kind === "agent" ? "agent" : "admin_key",
    orgId: row.org_id,
    keyId: row.id,
    keyPrefix: row.prefix,
    projectId: row.project_id,
  };
}

interface MembershipRow {
  org_id: string;
  role: OrgRole;
  created_at: string;
}

/** Resolve the Supabase session user, or 401. Used by session-only endpoints. */
export async function resolveSessionUser(): Promise<{ userId: string; email: string | null }> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new HttpError(401, "unauthenticated", "Sign in to access this endpoint");
  }
  return { userId: user.id, email: user.email ?? null };
}

export async function resolveActor(request: Request): Promise<Actor> {
  const header = request.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return resolveBearerActor(header.slice(7).trim());
  }

  const { userId } = await resolveSessionUser();
  const service = createServiceClient();
  const { data, error } = await service
    .from("org_members")
    .select("org_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const memberships = (data ?? []) as MembershipRow[];
  if (memberships.length === 0) {
    throw new HttpError(403, "no_org", "You are not a member of any organization yet");
  }

  const requestedOrgId = new URL(request.url).searchParams.get("orgId");
  const membership = requestedOrgId
    ? memberships.find((m) => m.org_id === requestedOrgId)
    : memberships[0];
  if (!membership) {
    throw new HttpError(403, "not_org_member", "You are not a member of that organization");
  }

  return { type: "user", userId, orgId: membership.org_id, role: membership.role };
}

/** Project-scoped agent/admin keys may only touch their own project. */
export function assertKeyScope(actor: Actor, projectId: string): void {
  if (actor.type !== "user" && actor.projectId !== null && actor.projectId !== projectId) {
    throw new HttpError(403, "key_scope", "This API key is scoped to a different project");
  }
}

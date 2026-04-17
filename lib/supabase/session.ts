import { createClient } from "./server"

export type SupabaseSessionData = {
  userId: string
  email: string
  organizationId: string | null
  organizationRole: "owner" | "admin" | "member"
  isSuperAdmin: boolean
}

/**
 * Resolve the current user + active org + role from the Supabase JWT.
 * Replacement for the Better Auth `getSessionData()` helper in lib/actions/utils.ts.
 * Throws if not authenticated.
 */
export async function getSupabaseSession(): Promise<SupabaseSessionData> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("unauthorized")
  }

  // JWT claims populated by custom_access_token_hook.
  const { data: session } = await supabase.auth.getSession()
  const claims = session?.session?.access_token
    ? decodeJwtClaims(session.session.access_token)
    : {}

  let organizationId =
    (claims.organization_id as string | undefined) ?? null
  let organizationRole =
    (claims.organization_role as "owner" | "admin" | "member" | undefined) ??
    "member"
  const isSuperAdmin = Boolean(claims.is_super_admin)

  // JWT custom claims (custom_access_token_hook) lag behind DB until refresh.
  // profiles.active_organization_id is updated on org create/switch first.
  if (!organizationId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("id", user.id)
      .maybeSingle()

    const activeId = profile?.active_organization_id ?? null
    if (activeId) {
      organizationId = activeId
      const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", activeId)
        .maybeSingle()
      if (
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.role === "member"
      ) {
        organizationRole = membership.role
      }
    }
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    organizationId,
    organizationRole,
    isSuperAdmin,
  }
}

export async function requireOrganization(): Promise<
  SupabaseSessionData & { organizationId: string }
> {
  const session = await getSupabaseSession()
  if (!session.organizationId) {
    throw new Error("no_active_organization")
  }
  return session as SupabaseSessionData & { organizationId: string }
}

/** Same as getSupabaseSession but returns null when there is no session (no throw). */
export async function getSupabaseSessionOptional(): Promise<SupabaseSessionData | null> {
  try {
    return await getSupabaseSession()
  } catch {
    return null
  }
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1]
    if (!payload) return {}
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8")
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return {}
  }
}

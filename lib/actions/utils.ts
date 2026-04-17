"use server"

import { getSupabaseSession } from "@/lib/supabase/session"

/**
 * Get the active organization ID for the current user.
 *
 * Source of truth: Supabase JWT claims stamped by `custom_access_token_hook`.
 * Returns null when there is no session or no active organization.
 */
export async function getOrganizationId(): Promise<string | null> {
  try {
    const s = await getSupabaseSession()
    return s.organizationId
  } catch {
    return null
  }
}

/**
 * Get the active organization ID and current user ID.
 */
export async function getSessionData(): Promise<{
  organizationId: string | null
  userId: string | null
}> {
  try {
    const s = await getSupabaseSession()
    return { organizationId: s.organizationId, userId: s.userId }
  } catch {
    return { organizationId: null, userId: null }
  }
}

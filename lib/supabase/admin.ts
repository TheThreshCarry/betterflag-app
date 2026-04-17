import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

/**
 * Admin (service-role) Supabase client. BYPASSES RLS.
 * Server-only — never import this from the browser or from code that runs
 * under a user's JWT. Use for: webhook handlers, sync jobs, admin backfills,
 * migration scripts.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    )
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

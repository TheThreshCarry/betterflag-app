import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "./types"

/**
 * Server-side Supabase client scoped to the current user's cookie session.
 * RLS is enforced under the user's JWT (active organization_id is stamped
 * into the token by custom_access_token_hook).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot set cookies; middleware handles refresh.
          }
        },
      },
    },
  )
}

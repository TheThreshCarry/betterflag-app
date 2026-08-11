/**
 * Server-side Supabase clients (same shape as the dashboard app).
 *
 * - `createSessionClient`: per-request, cookie-bound client used for
 *   session auth (which team member is signed in).
 * - `createServiceClient`: service-role client for every admin read and
 *   mutation. The whole app is super-admin surface, so all data access
 *   goes through the service role; the BETTERFLAG_ADMIN_EMAILS gate decides
 *   who may reach it.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { requiredEnv } from "../env";

export async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: cookie writes are not allowed
            // there. Middleware refreshes sessions, so this is safe to ignore.
          }
        },
      },
    },
  );
}

let cachedServiceClient: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (!cachedServiceClient) {
    cachedServiceClient = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return cachedServiceClient;
}

/**
 * Server-side Supabase clients.
 *
 * - `createSessionClient` — per-request, cookie-bound client used for
 *   session auth (dashboard users). Safe in server components, route
 *   handlers and server actions.
 * - `createServiceClient` — service-role client for control plane
 *   mutations (RPCs, guardrails, key lookups). Server-only: importing this
 *   module from a client component will fail at runtime because
 *   SUPABASE_SERVICE_ROLE_KEY is never exposed to the browser.
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

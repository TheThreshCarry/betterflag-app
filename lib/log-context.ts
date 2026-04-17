import { createLogger } from "@/lib/logger"
import type { SupabaseSessionData } from "@/lib/supabase/session"

/** Fields merged into every Pino log line when a session exists. */
export function sessionLogBindings(
  session: SupabaseSessionData | null | undefined,
): Record<string, string | boolean | null> {
  if (!session) return {}
  return {
    userId: session.userId,
    userEmail: session.email,
    organizationId: session.organizationId,
    organizationRole: session.organizationRole,
    isSuperAdmin: session.isSuperAdmin,
  }
}

export function createActionLogger(service: string, session: SupabaseSessionData) {
  return createLogger(service).child(sessionLogBindings(session))
}

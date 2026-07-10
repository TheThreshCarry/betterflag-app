/**
 * Pure/testable pieces of the welcome sequence: the trigger contract, org
 * state reads, and the decisions between emails. `src/index.ts` (which pulls
 * in `cloudflare:workers` and can't load under plain vitest) only wires these
 * to the Workflow + Email Service bindings.
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Trigger contract (zod at the boundary)
// ---------------------------------------------------------------------------

export const welcomeParamsSchema = z.object({
  orgId: z.uuid(),
  email: z.email(),
  orgName: z.string().min(1).max(120),
});

export type WelcomeParams = z.infer<typeof welcomeParamsSchema>;

export function instanceIdFor(orgId: string): string {
  return `welcome-${orgId}`;
}

export function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("Authorization") ?? "";
  return secret.length > 0 && header === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Org state check (between emails)
// ---------------------------------------------------------------------------

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/** What the workflow needs to know about an org before emailing it again. */
export interface OrgEmailState {
  exists: boolean;
  /** Raw Polar subscription status synced by shipos-webhooks (null = none). */
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

const orgRowSchema = z.object({
  subscription_status: z.string().nullable(),
  trial_ends_at: z.string().nullable(),
});

export async function readOrgState(env: SupabaseEnv, orgId: string): Promise<OrgEmailState> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, init) },
  });
  const result = await supabase
    .from("orgs")
    .select("subscription_status,trial_ends_at")
    .eq("id", orgId)
    .maybeSingle();
  if (result.error) throw new Error(`org query failed: ${result.error.message}`);
  if (result.data === null) return { exists: false, subscriptionStatus: null, trialEndsAt: null };
  const row = orgRowSchema.parse(result.data);
  return {
    exists: true,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
  };
}

/** A live subscription means upsell emails are noise, so skip them. */
export function hasActiveSubscription(state: OrgEmailState): boolean {
  return state.subscriptionStatus === "active" || state.subscriptionStatus === "trialing";
}

/** Whole days between now and the trial end, floored at 0. */
export function trialDaysLeft(trialEndsAt: string | null, now: Date = new Date()): number {
  if (trialEndsAt === null) return 0;
  const end = Date.parse(trialEndsAt);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

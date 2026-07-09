/**
 * Private-alpha gate (migration 20260709100000_alpha_allowlist).
 *
 * Gates ONBOARDING, not sign-in: users can always create a Supabase account,
 * but cannot create an org (and therefore reach the product) unless their
 * email is in public.alpha_allowlist. Existing org members bypass the check,
 * so admitted users and invited teammates keep access.
 *
 * Admit users with `bun run alpha:admit` (scripts/admit-alpha.ts).
 * Set ALPHA_GATE_DISABLED=1 to open signups at public launch.
 */

import { createServiceClient } from "./supabase/server";

export function alphaGateEnabled(): boolean {
  return process.env.ALPHA_GATE_DISABLED !== "1";
}

export async function isAllowedEmail(email: string | null): Promise<boolean> {
  if (!alphaGateEnabled()) return true;
  if (!email) return false;

  const service = createServiceClient();
  const { data, error } = await service
    .from("alpha_allowlist")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

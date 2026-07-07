/**
 * Server-side billing enforcement.
 *
 * Turns the org's synced Polar state (subscription_status + past_due_since,
 * written by the shipos-webhooks worker) into an access decision via the
 * billing-lifecycle policy, and blocks WRITES when the account is restricted.
 *
 * Reads are never gated here, and the edge data plane keeps serving flags, a
 * billing lapse makes the dashboard/API read-only, it never breaks production.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { canWrite } from "@/lib/billing-lifecycle";
import { billingDecisionForOrg } from "@/lib/billing-status";
import { getOrg } from "@/lib/db";
import { HttpError } from "@/lib/errors";

export { billingDecisionForOrg } from "@/lib/billing-status";

/**
 * Throw HTTP 402 when the org may not write (grace expired / unpaid / canceled).
 * Call at the top of every mutating route, after resolving the actor.
 */
export async function assertOrgWritable(service: SupabaseClient, orgId: string): Promise<void> {
  const org = await getOrg(service, orgId);
  const decision = billingDecisionForOrg(org);
  if (!canWrite(decision)) {
    throw new HttpError(402, "billing_restricted", decision.message);
  }
}

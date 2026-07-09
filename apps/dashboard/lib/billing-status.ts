/**
 * Pure mapping from stored org billing fields → a lifecycle decision.
 *
 * No server-only imports (Supabase/db), so it is safe to use from both the API
 * routes (via billing-guard) and shared type mappers rendered on the client.
 */
import {
  decideBilling,
  type BillingDecision,
  type SubscriptionStatus,
} from "@/lib/billing-lifecycle";

const KNOWN_STATUSES: readonly SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "none",
];

export interface OrgBillingFields {
  subscription_status: string | null;
  past_due_since: string | null;
  /** Drives access when no Polar subscription has ever been synced. */
  trial_ends_at: string;
}

export function normalizeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  return status && (KNOWN_STATUSES as readonly string[]).includes(status)
    ? (status as SubscriptionStatus)
    : "trialing";
}

/**
 * Orgs WITHOUT a synced Polar subscription ride on the trial clock:
 * full access while `trial_ends_at` is in the future, `expired` (dashboard
 * blocked, flags keep serving) once it passes. Orgs WITH a synced status get
 * the regular lifecycle policy (grace windows etc.).
 */
export function billingDecisionForOrg(org: OrgBillingFields, now: Date = new Date()): BillingDecision {
  const synced =
    org.subscription_status !== null &&
    (KNOWN_STATUSES as readonly string[]).includes(org.subscription_status);

  if (!synced) {
    const trialEnd = Date.parse(org.trial_ends_at);
    const trialExpired = !Number.isNaN(trialEnd) && trialEnd <= now.getTime();
    return decideBilling({ status: trialExpired ? "none" : "trialing", now });
  }

  return decideBilling({
    status: org.subscription_status as SubscriptionStatus,
    pastDueSince: org.past_due_since,
    now,
  });
}

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
}

/**
 * A null/unknown status means the org has never been through billing (pre-billing
 * or mid-trial), so it is treated as `trialing` (full access) rather than locked.
 */
export function normalizeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  return status && (KNOWN_STATUSES as readonly string[]).includes(status)
    ? (status as SubscriptionStatus)
    : "trialing";
}

export function billingDecisionForOrg(org: OrgBillingFields): BillingDecision {
  return decideBilling({
    status: normalizeSubscriptionStatus(org.subscription_status),
    pastDueSince: org.past_due_since,
  });
}

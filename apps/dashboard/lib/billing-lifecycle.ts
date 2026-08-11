/**
 * Billing lifecycle & non-payment policy (pure, unit-testable).
 *
 * Betterflag policy (decided July 2026):
 *  - A failed renewal moves the subscription to `past_due`. Polar retries the
 *    card (dunning) in parallel; Betterflag grants a **14-day grace period** from
 *    the moment the account went past_due, during which access is unchanged.
 *  - When grace expires (or the subscription is `unpaid` / `canceled`), the org
 *    becomes **restricted**: flag evaluations KEEP SERVING from the edge so the
 *    customer's production never breaks, but the dashboard and write APIs go
 *    read-only (no new flags, config changes, or agent keys) until they pay.
 *
 * This module maps a subscription's status + timing to a concrete access
 * decision. It is intentionally free of SDK/DB/network imports; the webhook
 * handler (future) feeds it `status` and `pastDueSince` from stored state.
 */

/** Polar subscription statuses (Stripe-shaped), plus `none` for no subscription. */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "none";

export const GRACE_PERIOD_DAYS = 14;
const DAY_MS = 86_400_000;

export type EffectiveState = "trialing" | "active" | "grace" | "restricted" | "expired";

export interface Access {
  /** Edge continues evaluating flags, customer production is never broken. */
  flagsServe: boolean;
  /** Dashboard mutations (create/edit/delete flags, config, keys). */
  dashboardWrites: boolean;
  /** Write endpoints on the REST/MCP API. */
  apiWrites: boolean;
}

export interface BillingInput {
  status: SubscriptionStatus;
  /** When the subscription first entered `past_due`. Drives the grace window. */
  pastDueSince?: Date | string | null;
  /** Override "now" for deterministic tests. */
  now?: Date;
}

export interface BillingDecision {
  state: EffectiveState;
  access: Access;
  /** End of the 14-day grace window (only when past_due), else null. */
  graceEndsAt: Date | null;
  /** Whole days until restriction while in grace; null otherwise. */
  daysUntilRestriction: number | null;
  message: string;
}

const FULL_ACCESS: Access = { flagsServe: true, dashboardWrites: true, apiWrites: true };
// Never break production: evaluations keep serving, everything else read-only.
const READ_ONLY: Access = { flagsServe: true, dashboardWrites: false, apiWrites: false };

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve the effective access decision for a subscription state.
 * Deterministic when `now` is supplied.
 */
export function decideBilling(input: BillingInput): BillingDecision {
  const now = input.now ?? new Date();

  switch (input.status) {
    case "trialing":
      return {
        state: "trialing",
        access: FULL_ACCESS,
        graceEndsAt: null,
        daysUntilRestriction: null,
        message: "Trial active.",
      };

    case "active":
      return {
        state: "active",
        access: FULL_ACCESS,
        graceEndsAt: null,
        daysUntilRestriction: null,
        message: "Subscription active.",
      };

    case "past_due": {
      // Grace runs from when we first saw past_due; if unknown, start it now.
      const start = toDate(input.pastDueSince) ?? now;
      const graceEndsAt = new Date(start.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
      if (now.getTime() < graceEndsAt.getTime()) {
        const daysUntilRestriction = Math.max(
          0,
          Math.ceil((graceEndsAt.getTime() - now.getTime()) / DAY_MS),
        );
        return {
          state: "grace",
          access: FULL_ACCESS,
          graceEndsAt,
          daysUntilRestriction,
          message: `Payment failed, update your card within ${daysUntilRestriction} day${
            daysUntilRestriction === 1 ? "" : "s"
          } to avoid the dashboard going read-only.`,
        };
      }
      return {
        state: "restricted",
        access: READ_ONLY,
        graceEndsAt,
        daysUntilRestriction: null,
        message:
          "Grace period ended. Your flags keep serving, but the dashboard is read-only until payment is updated.",
      };
    }

    case "unpaid":
    case "canceled":
      return {
        state: "restricted",
        access: READ_ONLY,
        graceEndsAt: null,
        daysUntilRestriction: null,
        message:
          "Subscription inactive. Flags keep serving; the dashboard is read-only until you resubscribe.",
      };

    case "incomplete":
    case "incomplete_expired":
    case "none":
    default:
      return {
        state: "expired",
        access: READ_ONLY,
        graceEndsAt: null,
        daysUntilRestriction: null,
        message: "No active subscription. Flags keep serving; the dashboard is read-only.",
      };
  }
}

/** Convenience guards for enforcement points. */
export function canWrite(decision: BillingDecision): boolean {
  return decision.access.dashboardWrites && decision.access.apiWrites;
}

export function isRestricted(decision: BillingDecision): boolean {
  return decision.state === "restricted" || decision.state === "expired";
}

/**
 * Canonical ShipOS pricing spec.
 *
 * This file is the SEED for Polar: `scripts/polar-setup.ts` reads it to create
 * the evaluations meter, the included-unit (meter-credit) benefits and the
 * three products. At runtime, Polar is the source of truth, `lib/pricing.ts`
 * reads pricing back out of Polar and both the dashboard and the landing page
 * render from it. This spec is also the safe fallback used when Polar can't be
 * reached, so the two stay in lockstep.
 *
 * To change prices/limits/features: edit them in Polar (the dashboard product
 * editor). Re-running the setup script with this file will re-seed a fresh
 * environment (e.g. promoting sandbox -> production).
 */

export type PlanKey = "starter" | "launch" | "scale";

/** Normalized tier shape consumed by the app + landing page. */
export interface PricingTier {
  key: PlanKey;
  name: string;
  tagline: string;
  popular: boolean;
  /** Fixed monthly price in cents. */
  priceCents: number;
  currency: string;
  /** Formatted price, e.g. "$9.99". */
  price: string;
  period: string;
  /** Included flag evaluations per month. */
  includedEvaluations: number;
  /** Overage price per additional 1M evaluations, in cents. */
  overagePerMillionCents: number;
  /** Human overage line, e.g. "$5 per additional 1M evaluations." */
  overage: string;
  /** null = unlimited. */
  projects: number | null;
  /** null = unlimited. */
  agentKeys: number | null;
  features: string[];
  cta: string;
  /** Ordering weight (ascending). */
  sort: number;
  /** Polar product id, present when the tier came from Polar. */
  productId?: string;
}

/** The event name the app ingests to Polar for the evaluations meter. */
export const EVALUATION_EVENT_NAME = "evaluation";

/** Meter name shown on customer invoices / usage. */
export const EVALUATION_METER_NAME = "Flag Evaluations";

export const CURRENCY = "usd";
export const TRIAL_DAYS = 14;

function fmtUsd(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2).replace(/\.00$/, "")}`;
}

function overageLine(perMillionCents: number): string {
  return `${fmtUsd(perMillionCents)} per additional 1M evaluations.`;
}

/**
 * The three tiers. Prices/limits mirror the landing page. Keep `priceCents`,
 * `includedEvaluations`, `overagePerMillionCents`, `projects`, `agentKeys`
 * aligned with `@shipos/db` PLAN_LIMITS (the server-side enforcement mirror).
 */
export const PRICING_SPEC: readonly PricingTier[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "For side projects.",
    popular: false,
    priceCents: 999,
    currency: CURRENCY,
    price: fmtUsd(999),
    period: "/mo",
    includedEvaluations: 2_000_000,
    overagePerMillionCents: 500,
    overage: overageLine(500),
    projects: 1,
    agentKeys: 1,
    features: [
      "2M evaluations / mo",
      "Unlimited flags, seats & environments",
      "1 project",
      "1 agent key (MCP + API)",
      "Community support",
    ],
    cta: "Start 14-day trial",
    sort: 1,
  },
  {
    key: "launch",
    name: "Launch",
    tagline: "For shipping founders.",
    popular: true,
    priceCents: 2499,
    currency: CURRENCY,
    price: fmtUsd(2499),
    period: "/mo",
    includedEvaluations: 10_000_000,
    overagePerMillionCents: 500,
    overage: overageLine(500),
    projects: 3,
    agentKeys: 5,
    features: [
      "10M evaluations / mo",
      "Unlimited flags, seats & environments",
      "3 projects",
      "5 agent keys (MCP + API)",
      "Scheduled rollouts + webhooks",
    ],
    cta: "Start 14-day trial",
    sort: 2,
  },
  {
    key: "scale",
    name: "Scale",
    tagline: "For growing teams.",
    popular: false,
    priceCents: 9999,
    currency: CURRENCY,
    price: fmtUsd(9999),
    period: "/mo",
    includedEvaluations: 100_000_000,
    overagePerMillionCents: 300,
    overage: overageLine(300),
    projects: null,
    agentKeys: null,
    features: [
      "100M evaluations / mo",
      "Unlimited projects & agent keys",
      "Approval guardrails for agents",
      "Audit log, RBAC & SSO, no enterprise gate",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    sort: 3,
  },
] as const;

/** Per-evaluation unit price (in cents) for the metered overage price. */
export function unitAmountFromPerMillion(perMillionCents: number): string {
  // e.g. 500 cents / 1,000,000 evals = 0.0005 cents per eval.
  return (perMillionCents / 1_000_000).toFixed(12).replace(/0+$/, "");
}

const UNLIMITED = -1;

/** Encode a nullable limit for Polar metadata (which cannot store null). */
export function encodeLimit(v: number | null): number {
  return v === null ? UNLIMITED : v;
}

/** Decode a limit read back from Polar metadata. */
export function decodeLimit(v: number): number | null {
  return v === UNLIMITED ? null : v;
}

/**
 * Reads pricing back OUT of Polar and normalizes it into `PricingTier[]`.
 *
 * Polar is the single source of truth: products created by `scripts/polar-setup.ts`
 * carry the price, the included-evaluations, the limits and the marketing
 * features (in product metadata). Both the dashboard and the landing page (via
 * the /api/pricing endpoint) render from this, so changing a price or a feature
 * in Polar updates every surface with no code change.
 *
 * If Polar is unreachable, we fall back to the canonical `PRICING_SPEC` so the
 * marketing page and dashboard never render an empty pricing table.
 *
 * Server-only, do not import from client components.
 */

import { PLAN_LIMITS, type OrgPlan } from "@betterflag/db";

import { getPolar } from "@/lib/polar";
import { PRICING_SPEC, type PlanKey, type PricingTier } from "@/lib/pricing-config";
import { mapPolarProductsToTiers, type PolarProductLike } from "@/lib/pricing-map";

const TTL_MS = 5 * 60 * 1000;

let memo: { at: number; tiers: PricingTier[] } | null = null;

async function fetchFromPolar(): Promise<PricingTier[]> {
  const polar = getPolar();
  const products: PolarProductLike[] = [];

  const iterator = await polar.products.list({ isArchived: false, isRecurring: true });
  for await (const page of iterator) {
    for (const p of page.result.items) {
      products.push(p as unknown as PolarProductLike);
    }
  }

  return mapPolarProductsToTiers(products);
}

/** Fallback copy of the canonical spec (deep clone so callers can't mutate it). */
function fallbackTiers(): PricingTier[] {
  return PRICING_SPEC.map((t) => ({ ...t, features: [...t.features] }));
}

/**
 * Returns the pricing tiers, from Polar when available (cached ~5min) and from
 * the canonical spec otherwise. Never throws.
 */
export async function getPricingTiers(opts?: { force?: boolean }): Promise<PricingTier[]> {
  if (!opts?.force && memo && Date.now() - memo.at < TTL_MS) return memo.tiers;
  try {
    const tiers = await fetchFromPolar();
    if (tiers.length > 0) {
      memo = { at: Date.now(), tiers };
      return tiers;
    }
    console.warn("[pricing] Polar returned no Betterflag tiers; using fallback spec.");
  } catch (err) {
    console.error("[pricing] Polar fetch failed; using fallback spec:", (err as Error)?.message);
  }
  return fallbackTiers();
}

/** The paid tier a plan maps to (trial demonstrates Launch-shaped limits). */
function planToTierKey(plan: OrgPlan): PlanKey {
  return plan === "trial" ? "launch" : plan;
}

/**
 * Plan limits (projects / agent keys / included evaluations) sourced from Polar,
 * falling back to the `@betterflag/db` PLAN_LIMITS enforcement mirror. Use for
 * display so the dashboard reflects whatever is currently configured in Polar.
 */
export async function limitsForPlan(
  plan: OrgPlan,
): Promise<{ projects: number | null; agentKeys: number | null; includedEvalsPerMonth: number }> {
  const tiers = await getPricingTiers();
  const tier = tiers.find((t) => t.key === planToTierKey(plan));
  if (!tier) return PLAN_LIMITS[plan];
  return {
    projects: tier.projects,
    agentKeys: tier.agentKeys,
    includedEvalsPerMonth: tier.includedEvaluations,
  };
}

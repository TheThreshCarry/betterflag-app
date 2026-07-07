"use client";

import { useEffect, useState } from "react";

import type { OrgPlan } from "@shipos/db";

import type { PlanKey, PricingTier } from "@/lib/pricing-config";

/** Client hook: loads the Polar-backed tiers from the public /api/pricing. */
export function usePricingTiers(): PricingTier[] | null {
  const [tiers, setTiers] = useState<PricingTier[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/pricing", { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((d: { tiers?: PricingTier[] }) => {
        if (active) setTiers(Array.isArray(d.tiers) ? d.tiers : []);
      })
      .catch(() => {
        if (active) setTiers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return tiers;
}

function planToTierKey(plan: OrgPlan): PlanKey {
  return plan === "trial" ? "launch" : plan;
}

/** The tier that a given org plan maps to (trial shows Launch-shaped limits). */
export function tierForPlan(
  tiers: PricingTier[] | null,
  plan: OrgPlan,
): PricingTier | undefined {
  if (!tiers) return undefined;
  return tiers.find((t) => t.key === planToTierKey(plan));
}

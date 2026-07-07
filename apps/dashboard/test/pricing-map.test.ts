import { describe, expect, it } from "vitest";

import {
  mapPolarProductToTier,
  mapPolarProductsToTiers,
  parseFeatures,
  type PolarProductLike,
} from "@/lib/pricing-map";

import polarProducts from "./fixtures/polar-products.json";

const products = polarProducts as unknown as PolarProductLike[];

describe("mapPolarProductsToTiers (recorded sandbox payload)", () => {
  const tiers = mapPolarProductsToTiers(products);

  it("returns the three tiers sorted by sort weight", () => {
    expect(tiers.map((t) => t.key)).toEqual(["starter", "launch", "scale"]);
  });

  it("maps Starter's fixed price, included evals and limits", () => {
    const starter = tiers.find((t) => t.key === "starter")!;
    expect(starter.priceCents).toBe(999);
    expect(starter.price).toBe("$9.99");
    expect(starter.currency).toBe("usd");
    expect(starter.includedEvaluations).toBe(2_000_000);
    expect(starter.overagePerMillionCents).toBe(500);
    expect(starter.projects).toBe(1);
    expect(starter.agentKeys).toBe(1);
    expect(starter.popular).toBe(false);
    expect(starter.features).toHaveLength(5);
    expect(starter.productId).toBe("b27cea13-00e7-4cd3-be57-049ca78811b1");
  });

  it("maps Launch as the popular tier", () => {
    const launch = tiers.find((t) => t.key === "launch")!;
    expect(launch.priceCents).toBe(2499);
    expect(launch.popular).toBe(true);
    expect(launch.projects).toBe(3);
    expect(launch.agentKeys).toBe(5);
  });

  it("decodes Scale's unlimited (-1) limits back to null", () => {
    const scale = tiers.find((t) => t.key === "scale")!;
    expect(scale.priceCents).toBe(9999);
    expect(scale.overagePerMillionCents).toBe(300);
    expect(scale.projects).toBeNull();
    expect(scale.agentKeys).toBeNull();
  });
});

describe("mapPolarProductToTier edge cases", () => {
  const base: PolarProductLike = {
    id: "p1",
    name: "Starter",
    description: "For side projects.",
    metadata: {
      plan_key: "starter",
      sort: 1,
      included_evaluations: 2_000_000,
      projects: 1,
      agent_keys: 1,
      features: '["a","b"]',
    },
    prices: [
      { amount_type: "fixed", price_currency: "usd", price_amount: 999 },
      { amount_type: "metered_unit", price_currency: "usd", unit_amount: "0.0005" },
    ],
  };

  it("skips products without a ShipOS plan_key", () => {
    expect(mapPolarProductToTier({ id: "x", name: "Random", metadata: {} })).toBeNull();
    expect(
      mapPolarProductToTier({ id: "x", name: "Random", metadata: { plan_key: "enterprise" } }),
    ).toBeNull();
  });

  it("skips archived products", () => {
    expect(mapPolarProductToTier({ ...base, is_archived: true })).toBeNull();
    expect(mapPolarProductToTier({ ...base, isArchived: true })).toBeNull();
  });

  it("derives overage from the metered unit price when metadata is absent", () => {
    const { overage_per_million_cents, ...metaNoOverage } = base.metadata as Record<string, unknown>;
    void overage_per_million_cents;
    const tier = mapPolarProductToTier({ ...base, metadata: metaNoOverage })!;
    // unit_amount 0.0005 cents/eval * 1,000,000 = 500 cents / 1M.
    expect(tier.overagePerMillionCents).toBe(500);
    expect(tier.overage).toBe("$5 per additional 1M evaluations.");
  });

  it("accepts camelCase (SDK-shaped) prices too", () => {
    const tier = mapPolarProductToTier({
      id: "p2",
      name: "Scale",
      metadata: { plan_key: "scale", sort: 3, projects: -1, agent_keys: -1 },
      prices: [
        { amountType: "fixed", priceCurrency: "usd", priceAmount: 9999 },
        { amountType: "metered_unit", priceCurrency: "usd", unitAmount: "0.0003" },
      ],
    })!;
    expect(tier.priceCents).toBe(9999);
    expect(tier.overagePerMillionCents).toBe(300);
    expect(tier.projects).toBeNull();
  });

  it("defaults gracefully when the fixed price is missing", () => {
    const tier = mapPolarProductToTier({
      id: "p3",
      name: "Starter",
      metadata: { plan_key: "starter" },
      prices: [],
    })!;
    expect(tier.priceCents).toBe(0);
    expect(tier.price).toBe("$0");
    expect(tier.currency).toBe("usd");
    expect(tier.features).toEqual([]);
  });
});

describe("parseFeatures", () => {
  it("parses a JSON-string array", () => {
    expect(parseFeatures('["one","two"]')).toEqual(["one", "two"]);
  });
  it("passes through a real array", () => {
    expect(parseFeatures(["one", "two"])).toEqual(["one", "two"]);
  });
  it("returns [] for malformed or non-array input", () => {
    expect(parseFeatures("not json")).toEqual([]);
    expect(parseFeatures('{"a":1}')).toEqual([]);
    expect(parseFeatures(undefined)).toEqual([]);
    expect(parseFeatures(42)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { PLAN_LIMITS } from "@betterflag/db";

import {
  PRICING_SPEC,
  TRIAL_DAYS,
  decodeLimit,
  encodeLimit,
  unitAmountFromPerMillion,
  type PlanKey,
} from "@/lib/pricing-config";

/** Type-safe tier lookup for assertions. */
function tier(key: PlanKey) {
  const found = PRICING_SPEC.find((t) => t.key === key);
  if (!found) throw new Error(`missing tier: ${key}`);
  return found;
}

describe("unitAmountFromPerMillion", () => {
  it("converts $/1M overage to per-evaluation cents", () => {
    // $5 / 1,000,000 = 0.0005 cents per evaluation.
    expect(unitAmountFromPerMillion(500)).toBe("0.0005");
    // $3 / 1,000,000 = 0.0003 cents per evaluation.
    expect(unitAmountFromPerMillion(300)).toBe("0.0003");
  });

  it("trims trailing zeros but keeps precision", () => {
    expect(unitAmountFromPerMillion(100)).toBe("0.0001");
    expect(unitAmountFromPerMillion(1000)).toBe("0.001");
  });

  it("round-trips back to the per-million price within a cent", () => {
    for (const perM of [300, 500, 700, 1234]) {
      const perEval = Number(unitAmountFromPerMillion(perM));
      expect(Math.round(perEval * 1_000_000)).toBe(perM);
    }
  });
});

describe("encodeLimit / decodeLimit", () => {
  it("represents unlimited (null) as -1 for Polar metadata", () => {
    expect(encodeLimit(null)).toBe(-1);
    expect(decodeLimit(-1)).toBeNull();
  });

  it("round-trips finite limits unchanged", () => {
    for (const n of [0, 1, 3, 5, 100]) {
      expect(decodeLimit(encodeLimit(n))).toBe(n);
    }
  });
});

describe("PRICING_SPEC integrity", () => {
  it("has exactly the three Betterflag tiers, uniquely keyed and ordered", () => {
    expect(PRICING_SPEC.map((t) => t.key)).toEqual(["starter", "launch", "scale"]);
    expect(new Set(PRICING_SPEC.map((t) => t.sort)).size).toBe(3);
    const sorted = [...PRICING_SPEC].sort((a, b) => a.sort - b.sort);
    expect(sorted.map((t) => t.key)).toEqual(["starter", "launch", "scale"]);
  });

  it("matches the published prices and included evaluations", () => {
    expect(tier("starter").priceCents).toBe(999);
    expect(tier("launch").priceCents).toBe(2499);
    expect(tier("scale").priceCents).toBe(9999);
    expect(tier("starter").includedEvaluations).toBe(1_000_000);
    expect(tier("launch").includedEvaluations).toBe(5_000_000);
    expect(tier("scale").includedEvaluations).toBe(50_000_000);
    expect(tier("starter").overagePerMillionCents).toBe(500);
    expect(tier("launch").overagePerMillionCents).toBe(400);
    expect(tier("scale").overagePerMillionCents).toBe(300);
  });

  it("formats the display price from the cents amount", () => {
    expect(tier("starter").price).toBe("$9.99");
    expect(tier("launch").price).toBe("$24.99");
    expect(tier("scale").price).toBe("$99.99");
    for (const t of PRICING_SPEC) expect(t.period).toBe("/mo");
  });

  it("marks exactly one tier as popular (Launch)", () => {
    expect(PRICING_SPEC.filter((t) => t.popular).map((t) => t.key)).toEqual(["launch"]);
  });

  it("gives every tier unlimited agent keys, and only Starter a project cap", () => {
    for (const t of PRICING_SPEC) expect(t.agentKeys).toBeNull();
    expect(tier("starter").projects).toBe(3);
    expect(tier("launch").projects).toBeNull();
    expect(tier("scale").projects).toBeNull();
  });

  it("has a non-empty feature list and overage line for every tier", () => {
    for (const t of PRICING_SPEC) {
      expect(t.features.length).toBeGreaterThanOrEqual(3);
      expect(t.overage).toMatch(/per additional 1M evaluations\.$/);
      expect(t.cta.length).toBeGreaterThan(0);
      expect(t.currency).toBe("usd");
    }
  });

  it("stays in lockstep with the @betterflag/db PLAN_LIMITS enforcement mirror", () => {
    // The server enforces limits from PLAN_LIMITS; the spec is the display/seed
    // source. Drift between them would bill or gate customers incorrectly.
    for (const t of PRICING_SPEC) {
      const limit = PLAN_LIMITS[t.key];
      expect(limit.includedEvalsPerMonth).toBe(t.includedEvaluations);
      expect(limit.projects).toBe(t.projects);
      expect(limit.agentKeys).toBe(t.agentKeys);
    }
  });

  it("offers a 14-day trial", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});

import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, STARTER_THROTTLE_MULTIPLIER, edgeQuotaForPlan } from "../src/index";

describe("edgeQuotaForPlan", () => {
  it("throttles only Starter, at 3× included", () => {
    expect(edgeQuotaForPlan("starter")).toBe(
      PLAN_LIMITS.starter.includedEvalsPerMonth * STARTER_THROTTLE_MULTIPLIER,
    );
    expect(edgeQuotaForPlan("starter")).toBe(3_000_000);
    expect(edgeQuotaForPlan("launch")).toBeNull();
    expect(edgeQuotaForPlan("scale")).toBeNull();
    expect(edgeQuotaForPlan("trial")).toBeNull();
  });
});

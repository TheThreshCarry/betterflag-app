import { describe, expect, it } from "vitest";

import { RULE_NAME_MAX, targetingRuleSchema } from "../src/schemas";

const base = {
  id: "r_abc123",
  conditions: [],
  serve: "on" as const,
};

describe("targetingRuleSchema name", () => {
  it("accepts rules without a name", () => {
    expect(targetingRuleSchema.parse(base).name).toBeUndefined();
  });

  it("accepts a display name without changing id", () => {
    const parsed = targetingRuleSchema.parse({ ...base, name: "EU beta" });
    expect(parsed.id).toBe("r_abc123");
    expect(parsed.name).toBe("EU beta");
  });

  it(`rejects names longer than ${RULE_NAME_MAX}`, () => {
    const result = targetingRuleSchema.safeParse({ ...base, name: "x".repeat(RULE_NAME_MAX + 1) });
    expect(result.success).toBe(false);
  });
});

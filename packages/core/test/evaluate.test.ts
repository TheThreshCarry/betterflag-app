import { describe, expect, it } from "vitest";
import { bucketFor } from "../src/bucket";
import { conditionMatches, evaluateFlag } from "../src/evaluate";
import type { EvaluationContext, FlagSnapshotEntry, TargetingRule } from "../src/types";

function entry(overrides: Partial<FlagSnapshotEntry> = {}): FlagSnapshotEntry {
  return {
    kind: "boolean",
    enabled: true,
    killed: false,
    rolloutPct: 100,
    rules: [],
    valueOn: true,
    valueOff: false,
    defaultValue: false,
    ...overrides,
  };
}

function rule(overrides: Partial<TargetingRule> = {}): TargetingRule {
  return { id: "r1", conditions: [], serve: "on", ...overrides };
}

describe("evaluateFlag precedence", () => {
  const ctx: EvaluationContext = { userId: "user-1" };

  it("serves fallback for unknown flags", () => {
    const res = evaluateFlag("nope", undefined, ctx, "fb");
    expect(res).toMatchObject({ value: "fb", reason: "not_found", variation: "default" });
  });

  it("serves null for unknown flags without fallback", () => {
    expect(evaluateFlag("nope", undefined, ctx).value).toBeNull();
  });

  it("killed wins over everything", () => {
    const res = evaluateFlag(
      "f",
      entry({ killed: true, rules: [rule()], rolloutPct: 100 }),
      ctx,
    );
    expect(res).toMatchObject({ value: false, reason: "killed", variation: "off" });
  });

  it("disabled wins over rules and rollout", () => {
    const res = evaluateFlag("f", entry({ enabled: false, rules: [rule()] }), ctx);
    expect(res).toMatchObject({ value: false, reason: "disabled" });
  });

  it("first matching rule wins, in order", () => {
    const rules = [
      rule({ id: "off-eu", conditions: [{ attribute: "region", op: "eq", value: "eu" }], serve: "off" }),
      rule({ id: "on-all", serve: "on" }),
    ];
    const eu = evaluateFlag("f", entry({ rules, rolloutPct: 0 }), {
      userId: "u",
      attributes: { region: "eu" },
    });
    expect(eu).toMatchObject({ variation: "off", reason: "rule_match", ruleId: "off-eu" });

    const us = evaluateFlag("f", entry({ rules, rolloutPct: 0 }), {
      userId: "u",
      attributes: { region: "us" },
    });
    expect(us).toMatchObject({ variation: "on", reason: "rule_match", ruleId: "on-all" });
  });

  it("empty conditions match everyone", () => {
    const res = evaluateFlag("f", entry({ rules: [rule({ serve: "off" })] }), ctx);
    expect(res).toMatchObject({ reason: "rule_match", variation: "off" });
  });

  it("rollout 100 serves on with reason default", () => {
    expect(evaluateFlag("f", entry({ rolloutPct: 100 }), ctx)).toMatchObject({
      variation: "on",
      reason: "default",
    });
  });

  it("rollout 0 serves off with reason default", () => {
    expect(evaluateFlag("f", entry({ rolloutPct: 0 }), ctx)).toMatchObject({
      variation: "off",
      reason: "default",
    });
  });

  it("partial rollout buckets on flagKey:userId", () => {
    const pct = 42;
    const flagEntry = entry({ rolloutPct: pct });
    for (let i = 0; i < 200; i++) {
      const userId = `user-${i}`;
      const res = evaluateFlag("f", flagEntry, { userId });
      const expectOn = bucketFor("f", userId) < pct;
      expect(res.variation).toBe(expectOn ? "on" : "off");
      expect(res.reason).toBe("rollout");
      expect(res.bucket).toBe(bucketFor("f", userId));
    }
  });

  it("anonymous contexts are off in partial rollouts", () => {
    const res = evaluateFlag("f", entry({ rolloutPct: 99 }), {});
    expect(res).toMatchObject({ variation: "off", reason: "rollout" });
    expect(res.bucket).toBeUndefined();
  });

  it("per-rule rollout serves matched-and-bucketed users, others fall through", () => {
    const rules = [
      rule({
        id: "beta",
        conditions: [{ attribute: "beta", op: "eq", value: true }],
        serve: "on",
        rolloutPct: 50,
      }),
    ];
    const flagEntry = entry({ rules, rolloutPct: 0 });
    let served = 0;
    let fellThrough = 0;
    for (let i = 0; i < 400; i++) {
      const res = evaluateFlag("f", flagEntry, {
        userId: `user-${i}`,
        attributes: { beta: true },
      });
      if (res.reason === "rule_match") served++;
      else {
        expect(res).toMatchObject({ variation: "off", reason: "default" });
        fellThrough++;
      }
    }
    expect(served).toBeGreaterThan(120);
    expect(fellThrough).toBeGreaterThan(120);
  });

  it("non-boolean kinds serve configured variation values", () => {
    const flagEntry = entry({
      kind: "json",
      valueOn: { theme: "dark", cta: "Buy now" },
      valueOff: { theme: "light", cta: "Start trial" },
      rolloutPct: 100,
    });
    expect(evaluateFlag("f", flagEntry, ctx).value).toEqual({ theme: "dark", cta: "Buy now" });
  });
});

describe("conditionMatches operators", () => {
  const ctx: EvaluationContext = {
    userId: "user-9",
    attributes: {
      plan: "scale",
      version: "2.3.1",
      age: 33,
      score: "88",
      tags: ["beta", "eu"],
      email: "mehdi@betterflag.app",
    },
  };

  const cases: Array<[string, boolean, Parameters<typeof conditionMatches>[1]]> = [
    ["eq matches", true, { attribute: "plan", op: "eq", value: "scale" }],
    ["eq mismatch", false, { attribute: "plan", op: "eq", value: "starter" }],
    ["eq userId", true, { attribute: "userId", op: "eq", value: "user-9" }],
    ["eq no coercion", false, { attribute: "age", op: "eq", value: "33" }],
    ["neq", true, { attribute: "plan", op: "neq", value: "starter" }],
    ["neq missing attribute is false", false, { attribute: "ghost", op: "neq", value: "x" }],
    ["in", true, { attribute: "plan", op: "in", value: ["launch", "scale"] }],
    ["in miss", false, { attribute: "plan", op: "in", value: ["launch"] }],
    ["not_in", true, { attribute: "plan", op: "not_in", value: ["starter"] }],
    ["not_in missing attribute is false", false, { attribute: "ghost", op: "not_in", value: ["x"] }],
    ["contains substring", true, { attribute: "email", op: "contains", value: "@betterflag" }],
    ["contains array member", true, { attribute: "tags", op: "contains", value: "beta" }],
    ["contains miss", false, { attribute: "tags", op: "contains", value: "alpha" }],
    ["gt", true, { attribute: "age", op: "gt", value: 30 }],
    ["gt equal is false", false, { attribute: "age", op: "gt", value: 33 }],
    ["gte equal", true, { attribute: "age", op: "gte", value: 33 }],
    ["lt", true, { attribute: "age", op: "lt", value: 40 }],
    ["lte", true, { attribute: "age", op: "lte", value: 33 }],
    ["numeric compare on numeric strings", true, { attribute: "score", op: "gt", value: 80 }],
    ["non-numeric strings never numerically compare", false, { attribute: "version", op: "gt", value: 2 }],
    ["semver_gt", true, { attribute: "version", op: "semver_gt", value: "2.3.0" }],
    ["semver_gt across prerelease", true, { attribute: "version", op: "semver_gt", value: "2.3.1-rc.1" }],
    ["semver_lt", true, { attribute: "version", op: "semver_lt", value: "2.10.0" }],
    ["semver_eq", true, { attribute: "version", op: "semver_eq", value: "v2.3.1" }],
    ["semver invalid never matches", false, { attribute: "plan", op: "semver_gt", value: "1.0.0" }],
  ];

  it.each(cases)("%s", (_name, expected, cond) => {
    expect(conditionMatches(ctx, cond)).toBe(expected);
  });
});

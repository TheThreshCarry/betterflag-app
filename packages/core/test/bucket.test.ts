import { describe, expect, it } from "vitest";
import { bucketFor, inRollout } from "../src/bucket";

describe("bucketFor", () => {
  it("is stable for the same flag/user pair", () => {
    const a = bucketFor("checkout-v2", "user-123");
    for (let i = 0; i < 10; i++) expect(bucketFor("checkout-v2", "user-123")).toBe(a);
  });

  it("is decorrelated across flags for the same user", () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 50; i++) buckets.add(bucketFor(`flag-${i}`, "user-123"));
    // 50 flags landing in fewer than 15 distinct buckets would mean correlation.
    expect(buckets.size).toBeGreaterThan(15);
  });

  it("distributes users roughly uniformly", () => {
    const counts = new Array<number>(100).fill(0);
    const n = 20000;
    for (let i = 0; i < n; i++) counts[bucketFor("distribution-check", `user-${i}`)]!++;
    const expected = n / 100;
    for (const count of counts) {
      expect(count).toBeGreaterThan(expected * 0.6);
      expect(count).toBeLessThan(expected * 1.4);
    }
  });

  it("only ever adds users as the percentage grows (monotonic rollouts)", () => {
    for (let i = 0; i < 500; i++) {
      const user = `user-${i}`;
      let wasIn = false;
      for (let pct = 0; pct <= 100; pct += 5) {
        const nowIn = inRollout("monotonic-check", user, pct);
        if (wasIn) expect(nowIn).toBe(true);
        wasIn = nowIn;
      }
    }
  });
});

/**
 * FROZEN cross-SDK vectors. Every SDK (JS, and later Python/Go/etc.) must
 * produce these exact buckets, or users will flip variations depending on
 * where the flag is evaluated. Never update these values — fix the code.
 */
describe("frozen bucketing vectors", () => {
  const VECTORS: Array<[flagKey: string, userId: string]> = [
    ["checkout-v2", "user-1"],
    ["checkout-v2", "user-2"],
    ["checkout-v2", "a5f9d3e0-6a2b-4c1d-9e8f-7a6b5c4d3e2f"],
    ["new-onboarding", "user-1"],
    ["dark-mode", "mehdi@shipos.app"],
    ["flag.with.dots", "user_with_underscores"],
    ["unicode-flag", "usér-ünïcode-λ"],
  ];

  it("matches the values in bucket-vectors.json", async () => {
    const { default: expected } = await import("./fixtures/bucket-vectors.json");
    const actual = VECTORS.map(([flagKey, userId]) => ({
      flagKey,
      userId,
      bucket: bucketFor(flagKey, userId),
    }));
    expect(actual).toEqual(expected);
  });
});

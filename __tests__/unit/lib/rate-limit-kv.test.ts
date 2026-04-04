import { describe, expect, it } from "vitest";
import {
  rateLimitKvKey,
  rateLimitWindowId,
} from "@/lib/rate-limit-kv";

describe("rateLimitWindowId", () => {
  it("computes fixed window index", () => {
    const w = 60_000;
    expect(rateLimitWindowId(0, w)).toBe(0);
    expect(rateLimitWindowId(59_999, w)).toBe(0);
    expect(rateLimitWindowId(60_000, w)).toBe(1);
    expect(rateLimitWindowId(120_000, w)).toBe(2);
  });
});

describe("rateLimitKvKey", () => {
  it("formats KV key", () => {
    expect(rateLimitKvKey("abc", 3)).toBe("v1::ratelimit::abc::3");
  });
});

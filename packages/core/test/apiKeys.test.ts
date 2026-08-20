import { describe, expect, it } from "vitest";
import { isSdkKeyThrottled } from "../src/apiKeys";

describe("isSdkKeyThrottled", () => {
  it("does not throttle when quota is missing or null", () => {
    expect(isSdkKeyThrottled({})).toBe(false);
    expect(isSdkKeyThrottled({ quota: null, used: 9_999_999 })).toBe(false);
  });

  it("throttles Starter at used >= quota", () => {
    expect(isSdkKeyThrottled({ quota: 3_000_000, used: 2_999_999 })).toBe(false);
    expect(isSdkKeyThrottled({ quota: 3_000_000, used: 3_000_000 })).toBe(true);
    expect(isSdkKeyThrottled({ quota: 3_000_000, used: 3_000_001 })).toBe(true);
  });

  it("treats missing used as 0", () => {
    expect(isSdkKeyThrottled({ quota: 1, used: undefined })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { KVKeys } from "@/lib/sync/kv-sync";

describe("KVKeys", () => {
  it("apiKeyHashed uses v1::apikey_h:: prefix", () => {
    expect(KVKeys.apiKeyHashed("abc123")).toBe("v1::apikey_h::abc123");
  });

  it("apiKeyLegacy preserves legacy format", () => {
    expect(KVKeys.apiKeyLegacy("sk_raw")).toBe("v1::apikey::sk_raw");
  });
});

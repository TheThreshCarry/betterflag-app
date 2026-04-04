import { describe, expect, it } from "vitest";
import { hashApiKey } from "@/lib/api-key-hash";

describe("hashApiKey", () => {
  it("returns a 64-character hex string (SHA-256)", async () => {
    const h = await hashApiKey("sk_test_example_key");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", async () => {
    const a = await hashApiKey("sk_same");
    const b = await hashApiKey("sk_same");
    expect(a).toBe(b);
  });
});

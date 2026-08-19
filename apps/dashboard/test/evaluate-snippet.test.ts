import { describe, expect, it } from "vitest";

import { buildEvaluateCurl } from "@/lib/evaluate-snippet";

describe("buildEvaluateCurl", () => {
  it("wires the flag key into POST /v1/evaluate", () => {
    const snippet = buildEvaluateCurl({
      flagKey: "testf",
      apiUrl: "https://api.betterflag.app",
    });

    expect(snippet).toContain("curl -X POST https://api.betterflag.app/v1/evaluate");
    expect(snippet).toContain("Authorization: Bearer bf_sdk_YOUR_KEY");
    expect(snippet).toContain(`-d '{"key":"testf","context":{"userId":"u_123"}}'`);
  });

  it("uses the provided SDK key and userId", () => {
    const snippet = buildEvaluateCurl({
      flagKey: "checkout",
      apiUrl: "https://api.example.test",
      sdkKey: "bf_sdk_abc",
      userId: "u_99",
    });

    expect(snippet).toContain("https://api.example.test/v1/evaluate");
    expect(snippet).toContain("Bearer bf_sdk_abc");
    expect(snippet).toContain(`-d '{"key":"checkout","context":{"userId":"u_99"}}'`);
  });
});

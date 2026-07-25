import { describe, expect, it } from "vitest";

import { buildCheckoutRequest } from "@/lib/checkout";

const base = {
  orgId: "org_123",
  productId: "prod_launch",
  planKey: "launch" as const,
  origin: "https://app.shipos.app",
};

describe("buildCheckoutRequest", () => {
  it("selects the plan's product", () => {
    expect(buildCheckoutRequest(base).products).toEqual(["prod_launch"]);
  });

  it("builds a success URL back to billing settings with the checkout id placeholder", () => {
    const { successUrl } = buildCheckoutRequest(base);
    expect(successUrl).toBe(
      "https://app.shipos.app/settings/billing?checkout=success&checkout_id={CHECKOUT_ID}",
    );
  });

  it("carries the org link two ways for webhook resolution", () => {
    const req = buildCheckoutRequest(base);
    // metadata is copied by Polar onto the resulting subscription.
    expect(req.metadata).toEqual({ org_id: "org_123", plan: "launch" });
    // externalCustomerId sets the Polar customer's external_id.
    expect(req.externalCustomerId).toBe("org_123");
  });

  it("prefills the customer email when provided", () => {
    const req = buildCheckoutRequest({ ...base, customerEmail: "mehdi@example.com" });
    expect(req.customerEmail).toBe("mehdi@example.com");
  });

  it("omits the email when not provided", () => {
    expect("customerEmail" in buildCheckoutRequest(base)).toBe(false);
    expect("customerEmail" in buildCheckoutRequest({ ...base, customerEmail: null })).toBe(false);
  });
});

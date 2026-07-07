import { describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertOrgWritable, billingDecisionForOrg } from "@/lib/billing-guard";
import { HttpError } from "@/lib/errors";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

describe("billingDecisionForOrg", () => {
  it("treats a null status as trialing (never lock pre-billing orgs)", () => {
    const d = billingDecisionForOrg({ subscription_status: null, past_due_since: null });
    expect(d.state).toBe("trialing");
    expect(d.access.dashboardWrites).toBe(true);
  });

  it("treats an unknown status as trialing", () => {
    const d = billingDecisionForOrg({ subscription_status: "weird", past_due_since: null });
    expect(d.state).toBe("trialing");
  });

  it("allows active", () => {
    const d = billingDecisionForOrg({ subscription_status: "active", past_due_since: null });
    expect(d.access.dashboardWrites).toBe(true);
  });

  it("allows past_due while inside the grace window", () => {
    const d = billingDecisionForOrg({ subscription_status: "past_due", past_due_since: daysAgo(3) });
    expect(d.state).toBe("grace");
    expect(d.access.dashboardWrites).toBe(true);
  });

  it("restricts past_due after the grace window (flags still serve)", () => {
    const d = billingDecisionForOrg({ subscription_status: "past_due", past_due_since: daysAgo(30) });
    expect(d.state).toBe("restricted");
    expect(d.access.flagsServe).toBe(true);
    expect(d.access.dashboardWrites).toBe(false);
  });

  it("restricts canceled / unpaid", () => {
    expect(
      billingDecisionForOrg({ subscription_status: "canceled", past_due_since: null }).access
        .dashboardWrites,
    ).toBe(false);
    expect(
      billingDecisionForOrg({ subscription_status: "unpaid", past_due_since: null }).access
        .dashboardWrites,
    ).toBe(false);
  });
});

// Minimal fake matching the getOrg query chain: from().select().eq().maybeSingle().
function fakeService(org: Record<string, unknown> | null): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: org, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const orgRow = (over: Record<string, unknown>) => ({
  id: "org_1",
  name: "Acme",
  plan: "launch",
  stripe_customer_id: null,
  trial_ends_at: daysAgo(-7),
  usage_cache: {},
  created_at: daysAgo(60),
  polar_customer_id: null,
  polar_subscription_id: null,
  subscription_status: null,
  past_due_since: null,
  billing_synced_at: null,
  ...over,
});

describe("assertOrgWritable", () => {
  it("resolves for a writable org", async () => {
    await expect(
      assertOrgWritable(fakeService(orgRow({ subscription_status: "active" })), "org_1"),
    ).resolves.toBeUndefined();
  });

  it("throws 402 billing_restricted for a restricted org", async () => {
    const service = fakeService(orgRow({ subscription_status: "canceled" }));
    await expect(assertOrgWritable(service, "org_1")).rejects.toMatchObject({
      status: 402,
      code: "billing_restricted",
    });
    await expect(assertOrgWritable(service, "org_1")).rejects.toBeInstanceOf(HttpError);
  });
});

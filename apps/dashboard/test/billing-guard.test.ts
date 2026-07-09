import { describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertOrgWritable, billingDecisionForOrg } from "@/lib/billing-guard";
import { HttpError } from "@/lib/errors";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

// A trial that ends in 7 days (the common case for un-synced orgs).
const LIVE_TRIAL = daysAgo(-7);

describe("billingDecisionForOrg", () => {
  it("treats a null status with a live trial as trialing", () => {
    const d = billingDecisionForOrg({
      subscription_status: null,
      past_due_since: null,
      trial_ends_at: LIVE_TRIAL,
    });
    expect(d.state).toBe("trialing");
    expect(d.access.dashboardWrites).toBe(true);
  });

  it("treats an unknown status with a live trial as trialing", () => {
    const d = billingDecisionForOrg({
      subscription_status: "weird",
      past_due_since: null,
      trial_ends_at: LIVE_TRIAL,
    });
    expect(d.state).toBe("trialing");
  });

  it("expires a null-status org whose trial has ended (flags still serve)", () => {
    const d = billingDecisionForOrg({
      subscription_status: null,
      past_due_since: null,
      trial_ends_at: daysAgo(1),
    });
    expect(d.state).toBe("expired");
    expect(d.access.flagsServe).toBe(true);
    expect(d.access.dashboardWrites).toBe(false);
  });

  it("never locks a null-status org with an unparseable trial date", () => {
    const d = billingDecisionForOrg({
      subscription_status: null,
      past_due_since: null,
      trial_ends_at: "not-a-date",
    });
    expect(d.state).toBe("trialing");
  });

  it("an expired trial does NOT override a synced active subscription", () => {
    const d = billingDecisionForOrg({
      subscription_status: "active",
      past_due_since: null,
      trial_ends_at: daysAgo(30),
    });
    expect(d.state).toBe("active");
    expect(d.access.dashboardWrites).toBe(true);
  });

  it("allows active", () => {
    const d = billingDecisionForOrg({
      subscription_status: "active",
      past_due_since: null,
      trial_ends_at: LIVE_TRIAL,
    });
    expect(d.access.dashboardWrites).toBe(true);
  });

  it("allows past_due while inside the grace window", () => {
    const d = billingDecisionForOrg({
      subscription_status: "past_due",
      past_due_since: daysAgo(3),
      trial_ends_at: LIVE_TRIAL,
    });
    expect(d.state).toBe("grace");
    expect(d.access.dashboardWrites).toBe(true);
  });

  it("restricts past_due after the grace window (flags still serve)", () => {
    const d = billingDecisionForOrg({
      subscription_status: "past_due",
      past_due_since: daysAgo(30),
      trial_ends_at: LIVE_TRIAL,
    });
    expect(d.state).toBe("restricted");
    expect(d.access.flagsServe).toBe(true);
    expect(d.access.dashboardWrites).toBe(false);
  });

  it("restricts canceled / unpaid", () => {
    expect(
      billingDecisionForOrg({
        subscription_status: "canceled",
        past_due_since: null,
        trial_ends_at: LIVE_TRIAL,
      }).access.dashboardWrites,
    ).toBe(false);
    expect(
      billingDecisionForOrg({
        subscription_status: "unpaid",
        past_due_since: null,
        trial_ends_at: LIVE_TRIAL,
      }).access.dashboardWrites,
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

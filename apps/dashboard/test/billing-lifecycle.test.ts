import { describe, expect, it } from "vitest";

import {
  GRACE_PERIOD_DAYS,
  canWrite,
  decideBilling,
  isRestricted,
  type SubscriptionStatus,
} from "@/lib/billing-lifecycle";

const DAY = 86_400_000;
const NOW = new Date("2026-07-07T12:00:00.000Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("policy constants", () => {
  it("uses a 14-day grace period", () => {
    expect(GRACE_PERIOD_DAYS).toBe(14);
  });
});

describe("healthy states", () => {
  it("trialing → full access", () => {
    const d = decideBilling({ status: "trialing", now: NOW });
    expect(d.state).toBe("trialing");
    expect(d.access).toEqual({ flagsServe: true, dashboardWrites: true, apiWrites: true });
    expect(canWrite(d)).toBe(true);
    expect(isRestricted(d)).toBe(false);
  });

  it("active → full access", () => {
    const d = decideBilling({ status: "active", now: NOW });
    expect(d.state).toBe("active");
    expect(canWrite(d)).toBe(true);
  });
});

describe("past_due grace window", () => {
  it("keeps full access during the 14-day grace and counts down", () => {
    const d = decideBilling({ status: "past_due", pastDueSince: ago(3), now: NOW });
    expect(d.state).toBe("grace");
    expect(canWrite(d)).toBe(true);
    expect(d.access.flagsServe).toBe(true);
    expect(d.daysUntilRestriction).toBe(11);
    expect(d.graceEndsAt).toEqual(new Date(ago(3).getTime() + 14 * DAY));
    expect(d.message).toContain("11 days");
  });

  it("uses singular 'day' at exactly one day left", () => {
    const d = decideBilling({ status: "past_due", pastDueSince: ago(13), now: NOW });
    expect(d.daysUntilRestriction).toBe(1);
    expect(d.message).toContain("1 day ");
  });

  it("starts the grace window now when pastDueSince is unknown", () => {
    const d = decideBilling({ status: "past_due", pastDueSince: null, now: NOW });
    expect(d.state).toBe("grace");
    expect(d.daysUntilRestriction).toBe(GRACE_PERIOD_DAYS);
    expect(d.graceEndsAt).toEqual(new Date(NOW.getTime() + 14 * DAY));
  });

  it("accepts an ISO string for pastDueSince", () => {
    const d = decideBilling({
      status: "past_due",
      pastDueSince: ago(5).toISOString(),
      now: NOW,
    });
    expect(d.state).toBe("grace");
    expect(d.daysUntilRestriction).toBe(9);
  });

  it("restricts exactly at the grace boundary (flags still serve)", () => {
    const d = decideBilling({ status: "past_due", pastDueSince: ago(14), now: NOW });
    expect(d.state).toBe("restricted");
    expect(d.access).toEqual({ flagsServe: true, dashboardWrites: false, apiWrites: false });
    expect(canWrite(d)).toBe(false);
    expect(d.daysUntilRestriction).toBeNull();
  });

  it("restricts after the grace window while keeping flags serving", () => {
    const d = decideBilling({ status: "past_due", pastDueSince: ago(20), now: NOW });
    expect(d.state).toBe("restricted");
    expect(d.access.flagsServe).toBe(true);
    expect(d.access.dashboardWrites).toBe(false);
    expect(isRestricted(d)).toBe(true);
  });
});

describe("inactive states → read-only, flags keep serving", () => {
  it.each<SubscriptionStatus>(["unpaid", "canceled"])(
    "%s → restricted read-only",
    (status) => {
      const d = decideBilling({ status, now: NOW });
      expect(d.state).toBe("restricted");
      expect(d.access).toEqual({ flagsServe: true, dashboardWrites: false, apiWrites: false });
      expect(canWrite(d)).toBe(false);
    },
  );

  it.each<SubscriptionStatus>(["incomplete", "incomplete_expired", "none"])(
    "%s → expired read-only",
    (status) => {
      const d = decideBilling({ status, now: NOW });
      expect(d.state).toBe("expired");
      expect(d.access.flagsServe).toBe(true);
      expect(d.access.dashboardWrites).toBe(false);
      expect(isRestricted(d)).toBe(true);
    },
  );
});

describe("core invariant: flags never stop serving on non-payment", () => {
  const statuses: SubscriptionStatus[] = [
    "trialing",
    "active",
    "past_due",
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "none",
  ];

  it.each(statuses)("%s keeps flagsServe = true", (status) => {
    // Even deep past_due keeps serving.
    const d = decideBilling({ status, pastDueSince: ago(90), now: NOW });
    expect(d.access.flagsServe).toBe(true);
  });

  it("only grace/active/trialing permit writes", () => {
    for (const status of statuses) {
      const d = decideBilling({ status, pastDueSince: ago(2), now: NOW });
      const writable = ["trialing", "active", "grace"].includes(d.state);
      expect(canWrite(d)).toBe(writable);
    }
  });
});

describe("determinism", () => {
  it("is a pure function of its inputs", () => {
    const input = { status: "past_due" as const, pastDueSince: ago(6), now: NOW };
    expect(decideBilling(input)).toEqual(decideBilling(input));
  });
});

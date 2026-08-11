import { describe, expect, it } from "vitest";

import {
  agenticEmail,
  escapeHtml,
  trialEndingEmail,
  trialEndingUpsellEmail,
  welcomeEmail,
  FROM_ADDRESS,
} from "../src/emails";
import {
  formatEvals,
  hasActiveSubscription,
  instanceIdFor,
  isAuthorized,
  projectMonthlyEvals,
  readTrialEvals,
  recommendTier,
  trialDaysElapsed,
  trialDaysLeft,
  trialUpsellRecommendation,
  welcomeParamsSchema,
  UPSELL_TIERS,
} from "../src/sequence";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

describe("welcomeParamsSchema", () => {
  it("accepts a well-formed trigger payload", () => {
    const parsed = welcomeParamsSchema.safeParse({
      orgId: ORG_ID,
      email: "founder@example.com",
      orgName: "Acme Inc",
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    ["non-uuid orgId", { orgId: "org-1", email: "a@b.com", orgName: "x" }],
    ["bad email", { orgId: ORG_ID, email: "nope", orgName: "x" }],
    ["empty orgName", { orgId: ORG_ID, email: "a@b.com", orgName: "" }],
    ["missing field", { orgId: ORG_ID, email: "a@b.com" }],
  ])("rejects %s", (_label, value) => {
    expect(welcomeParamsSchema.safeParse(value).success).toBe(false);
  });
});

describe("instanceIdFor", () => {
  it("is deterministic per org (idempotent triggers)", () => {
    expect(instanceIdFor(ORG_ID)).toBe(`welcome-${ORG_ID}`);
  });
});

describe("isAuthorized", () => {
  const request = (auth?: string) =>
    new Request("https://lifecycle.example/trigger", {
      method: "POST",
      headers: auth ? { Authorization: auth } : {},
    });

  it("accepts the exact bearer secret", () => {
    expect(isAuthorized(request("Bearer s3cret"), "s3cret")).toBe(true);
  });

  it("rejects wrong or missing secrets, and empty configured secrets", () => {
    expect(isAuthorized(request("Bearer nope"), "s3cret")).toBe(false);
    expect(isAuthorized(request(), "s3cret")).toBe(false);
    expect(isAuthorized(request("Bearer "), "")).toBe(false);
  });
});

describe("hasActiveSubscription", () => {
  it.each([
    ["active", true],
    ["trialing", true],
    ["past_due", false],
    ["canceled", false],
    [null, false],
  ] as const)("status %s → %s", (status, expected) => {
    expect(
      hasActiveSubscription({
        exists: true,
        subscriptionStatus: status,
        trialEndsAt: null,
        logoUrl: null,
      }),
    ).toBe(expected);
  });
});

describe("trialDaysLeft", () => {
  const now = new Date("2026-07-08T12:00:00Z");

  it("counts whole days up, floors at zero, tolerates garbage", () => {
    expect(trialDaysLeft("2026-07-12T12:00:00Z", now)).toBe(4);
    expect(trialDaysLeft("2026-07-08T18:00:00Z", now)).toBe(1);
    expect(trialDaysLeft("2026-07-01T00:00:00Z", now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
    expect(trialDaysLeft("not-a-date", now)).toBe(0);
  });
});

describe("email templates", () => {
  it("welcome email includes the org name, escaped", () => {
    const email = welcomeEmail("Acme <&> Sons");
    expect(email.subject).toContain("Welcome");
    expect(email.html).toContain("Acme &lt;&amp;&gt; Sons");
    expect(email.text).toContain("Acme <&> Sons");
    expect(email.html).toContain("app.betterflag.app/onboarding");
  });

  it("agentic email points at the keys page and the MCP server", () => {
    const email = agenticEmail();
    expect(email.html).toContain("mcp.betterflag.app");
    expect(email.html).toContain("app.betterflag.app/settings/keys");
    expect(email.text).toContain("mcp.betterflag.app");
  });

  it("trial-ending email renders the day count in words", () => {
    expect(trialEndingEmail(4).subject).toBe("Your Betterflag trial ends in 4 days");
    expect(trialEndingEmail(1).subject).toBe("Your Betterflag trial ends tomorrow");
    expect(trialEndingEmail(0).subject).toBe("Your Betterflag trial ends today");
    expect(trialEndingEmail(-3).subject).toBe("Your Betterflag trial ends today");
    expect(trialEndingEmail(4).html).toContain("app.betterflag.app/settings");
  });

  it("every email has both html and text bodies and the reply-note footer", () => {
    for (const email of [welcomeEmail("Acme"), agenticEmail(), trialEndingEmail(3)]) {
      expect(email.html.length).toBeGreaterThan(200);
      expect(email.text.length).toBeGreaterThan(100);
      expect(email.html).toContain("Reply any time");
      expect(email.text).toContain("Reply any time");
    }
  });

  it("sender is the founder address on betterflag.app", () => {
    expect(FROM_ADDRESS.email).toBe("hi@betterflag.app");
  });
});

describe("escapeHtml", () => {
  it("escapes the five specials", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

// ---------------------------------------------------------------------------
// Day-10 usage-based tier upsell
// ---------------------------------------------------------------------------

const STARTER = UPSELL_TIERS[0].includedEvalsPerMonth;
const LAUNCH = UPSELL_TIERS[1].includedEvalsPerMonth;
const SCALE = UPSELL_TIERS[2].includedEvalsPerMonth;

describe("projectMonthlyEvals", () => {
  it("pro-rates a daily rate to a 30-day month", () => {
    expect(projectMonthlyEvals(1_000_000, 10)).toBe(3_000_000);
    expect(projectMonthlyEvals(700_000, 14)).toBe(1_500_000);
  });

  it("is zero for no usage or no observed days", () => {
    expect(projectMonthlyEvals(0, 14)).toBe(0);
    expect(projectMonthlyEvals(500, 0)).toBe(0);
  });
});

describe("trialDaysElapsed", () => {
  const now = new Date("2026-07-08T12:00:00Z");

  it("is the 14-day window minus days left, clamped to [1,14]", () => {
    expect(trialDaysElapsed("2026-07-12T12:00:00Z", now)).toBe(10); // 4 left
    expect(trialDaysElapsed("2026-07-08T12:00:00Z", now)).toBe(14); // 0 left
    expect(trialDaysElapsed("2026-07-30T12:00:00Z", now)).toBe(1); // >14 left, clamp
    expect(trialDaysElapsed(null, now)).toBe(14);
  });
});

describe("recommendTier", () => {
  it("returns null while the entry tier still fits (incl. the boundary)", () => {
    expect(recommendTier(STARTER - 1)).toBeNull();
    expect(recommendTier(STARTER)).toBeNull();
  });

  it("recommends the smallest tier that covers the projected usage", () => {
    expect(recommendTier(STARTER + 1)?.tier.key).toBe("launch");
    expect(recommendTier(LAUNCH)?.tier.key).toBe("launch");
    expect(recommendTier(LAUNCH + 1)?.tier.key).toBe("scale");
    expect(recommendTier(SCALE)?.tier.key).toBe("scale");
  });

  it("flags usage past the top tier as exceedsTopTier (Scale or more)", () => {
    const rec = recommendTier(SCALE + 1);
    expect(rec?.tier.key).toBe("scale");
    expect(rec?.exceedsTopTier).toBe(true);
    expect(recommendTier(LAUNCH + 1)?.exceedsTopTier).toBe(false);
  });
});

describe("formatEvals", () => {
  it("renders compact eval counts", () => {
    expect(formatEvals(950_000)).toBe("950K");
    expect(formatEvals(1_500_000)).toBe("1.5M");
    expect(formatEvals(2_000_000)).toBe("2M");
    expect(formatEvals(7_500_000)).toBe("7.5M");
    expect(formatEvals(10_000_000)).toBe("10M");
    expect(formatEvals(500)).toBe("500");
  });
});

describe("readTrialEvals", () => {
  const ORG = "22222222-2222-4222-8222-222222222222";
  const chEnv = {
    CLICKHOUSE_URL: "https://ch.example/",
    CLICKHOUSE_USER: "u",
    CLICKHOUSE_PASSWORD: "p",
  };

  it("returns null when ClickHouse is unconfigured", async () => {
    expect(await readTrialEvals({}, ORG)).toBeNull();
  });

  it("sums the meter from a JSONEachRow response", async () => {
    const fetchFn = async () => new Response(`{"evaluations":"1400000"}\n`, { status: 200 });
    expect(await readTrialEvals(chEnv, ORG, 14, fetchFn as unknown as typeof fetch)).toBe(1_400_000);
  });

  it("treats an empty result as zero and a non-2xx as null", async () => {
    const empty = async () => new Response("", { status: 200 });
    const bad = async () => new Response("boom", { status: 500 });
    expect(await readTrialEvals(chEnv, ORG, 14, empty as unknown as typeof fetch)).toBe(0);
    expect(await readTrialEvals(chEnv, ORG, 14, bad as unknown as typeof fetch)).toBeNull();
  });
});

describe("trialUpsellRecommendation", () => {
  const ORG = "33333333-3333-4333-8333-333333333333";
  const now = new Date("2026-07-08T12:00:00Z");
  const chEnv = { CLICKHOUSE_URL: "https://ch.example/", CLICKHOUSE_USER: "u", CLICKHOUSE_PASSWORD: "p" };

  it("recommends a tier when usage pro-rates past Starter", async () => {
    // 1M evals over 10 observed days -> 3M/mo projected -> Launch.
    const fetchFn = async () => new Response(`{"evaluations":1000000}`, { status: 200 });
    const rec = await trialUpsellRecommendation(
      chEnv,
      ORG,
      "2026-07-12T12:00:00Z",
      now,
      fetchFn as unknown as typeof fetch,
    );
    expect(rec?.tier.key).toBe("launch");
    expect(rec?.projectedMonthlyEvals).toBe(3_000_000);
  });

  it("returns null (generic email) when Starter still fits", async () => {
    const fetchFn = async () => new Response(`{"evaluations":100000}`, { status: 200 });
    const rec = await trialUpsellRecommendation(
      chEnv,
      ORG,
      "2026-07-12T12:00:00Z",
      now,
      fetchFn as unknown as typeof fetch,
    );
    expect(rec).toBeNull();
  });

  it("returns null when ClickHouse is unconfigured", async () => {
    expect(await trialUpsellRecommendation({}, ORG, "2026-07-12T12:00:00Z", now)).toBeNull();
  });
});

describe("trialEndingUpsellEmail", () => {
  it("names the recommended tier, price and projected usage", () => {
    const email = trialEndingUpsellEmail(4, {
      tier: UPSELL_TIERS[1],
      projectedMonthlyEvals: 7_500_000,
      exceedsTopTier: false,
    });
    expect(email.subject).toContain("Launch");
    expect(email.html).toContain("7.5M");
    expect(email.html).toContain("$24.99");
    expect(email.html).toContain("app.betterflag.app/settings");
    expect(email.text).toContain("7.5M");
    expect(email.html).toContain("Reply any time");
  });

  it("switches to a volume conversation past the top tier", () => {
    const email = trialEndingUpsellEmail(2, {
      tier: UPSELL_TIERS[2],
      projectedMonthlyEvals: 120_000_000,
      exceedsTopTier: true,
    });
    expect(email.subject).toContain("120M");
    expect(email.text.toLowerCase()).toContain("volume");
    expect(email.html).toContain("120M");
  });
});

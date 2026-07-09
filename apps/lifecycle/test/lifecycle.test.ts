import { describe, expect, it } from "vitest";

import {
  agenticEmail,
  escapeHtml,
  trialEndingEmail,
  welcomeEmail,
  FROM_ADDRESS,
} from "../src/emails";
import {
  hasActiveSubscription,
  instanceIdFor,
  isAuthorized,
  trialDaysLeft,
  welcomeParamsSchema,
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
      hasActiveSubscription({ exists: true, subscriptionStatus: status, trialEndsAt: null }),
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
    expect(email.html).toContain("app.shipos.app/onboarding");
  });

  it("agentic email points at the keys page and the MCP server", () => {
    const email = agenticEmail();
    expect(email.html).toContain("mcp.shipos.app");
    expect(email.html).toContain("app.shipos.app/keys");
    expect(email.text).toContain("mcp.shipos.app");
  });

  it("trial-ending email renders the day count in words", () => {
    expect(trialEndingEmail(4).subject).toBe("Your ShipOS trial ends in 4 days");
    expect(trialEndingEmail(1).subject).toBe("Your ShipOS trial ends tomorrow");
    expect(trialEndingEmail(0).subject).toBe("Your ShipOS trial ends today");
    expect(trialEndingEmail(-3).subject).toBe("Your ShipOS trial ends today");
    expect(trialEndingEmail(4).html).toContain("app.shipos.app/settings");
  });

  it("every email has both html and text bodies and the reply-note footer", () => {
    for (const email of [welcomeEmail("Acme"), agenticEmail(), trialEndingEmail(3)]) {
      expect(email.html.length).toBeGreaterThan(200);
      expect(email.text.length).toBeGreaterThan(100);
      expect(email.html).toContain("Reply any time");
      expect(email.text).toContain("Reply any time");
    }
  });

  it("sender is the founder address on shipos.app", () => {
    expect(FROM_ADDRESS.email).toBe("hi@shipos.app");
  });
});

describe("escapeHtml", () => {
  it("escapes the five specials", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

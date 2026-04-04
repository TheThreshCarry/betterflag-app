import { describe, expect, it, vi, beforeEach } from "vitest";

const getStateExternal = vi.fn();

vi.mock("@/lib/polar/index", () => ({
  polarClient: {
    customers: {
      getStateExternal: (...args: unknown[]) => getStateExternal(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

describe("getPlanSlugForUser", () => {
  beforeEach(() => {
    vi.resetModules();
    getStateExternal.mockReset();
    vi.stubEnv("POLAR_ACCESS_TOKEN", "token");
  });

  it("returns free when Polar token is not set", async () => {
    vi.stubEnv("POLAR_ACCESS_TOKEN", "");
    const { getPlanSlugForUser } = await import("@/lib/polar/org-plan");
    expect(await getPlanSlugForUser("user-1")).toBe("free");
  });

  it("returns free when Polar throws", async () => {
    getStateExternal.mockRejectedValue(new Error("not found"));
    const { getPlanSlugForUser } = await import("@/lib/polar/org-plan");
    expect(await getPlanSlugForUser("user-1")).toBe("free");
  });

  it("returns team when active subscription matches POLAR_TEAM_PRODUCT_ID", async () => {
    vi.stubEnv("POLAR_TEAM_PRODUCT_ID", "prod_team");
    vi.stubEnv("POLAR_PRO_PRODUCT_ID", "prod_pro");
    getStateExternal.mockResolvedValue({
      activeSubscriptions: [
        { status: "active", productId: "prod_team" },
      ],
    });
    const { getPlanSlugForUser } = await import("@/lib/polar/org-plan");
    expect(await getPlanSlugForUser("user-1")).toBe("team");
  });

  it("returns pro when subscription matches POLAR_PRO_PRODUCT_ID", async () => {
    vi.stubEnv("POLAR_TEAM_PRODUCT_ID", "prod_team");
    vi.stubEnv("POLAR_PRO_PRODUCT_ID", "prod_pro");
    getStateExternal.mockResolvedValue({
      activeSubscriptions: [
        { status: "active", productId: "prod_pro" },
      ],
    });
    const { getPlanSlugForUser } = await import("@/lib/polar/org-plan");
    expect(await getPlanSlugForUser("user-1")).toBe("pro");
  });

  it("returns free when there are no active subscriptions", async () => {
    vi.stubEnv("POLAR_TEAM_PRODUCT_ID", "prod_team");
    getStateExternal.mockResolvedValue({
      activeSubscriptions: [{ status: "canceled", productId: "prod_team" }],
    });
    const { getPlanSlugForUser } = await import("@/lib/polar/org-plan");
    expect(await getPlanSlugForUser("user-1")).toBe("free");
  });
});

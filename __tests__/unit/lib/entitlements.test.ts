import { describe, expect, it, vi, beforeEach } from "vitest"

const maybeSingle = vi.fn()
const limit = vi.fn(() => ({ maybeSingle }))
const order = vi.fn(() => ({ limit }))
const inFn = vi.fn(() => ({ order }))
const eq = vi.fn(() => ({ in: inFn }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}))

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

describe("getOrganizationEntitlements", () => {
  beforeEach(() => {
    vi.resetModules()
    maybeSingle.mockReset()
    vi.stubEnv("POLAR_TEAM_PRODUCT_ID", "prod_team")
    vi.stubEnv("POLAR_PRO_PRODUCT_ID", "prod_pro")
  })

  it("returns free plan when no active subscription", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const { getOrganizationEntitlements } = await import(
      "@/lib/billing/entitlements"
    )
    const ent = await getOrganizationEntitlements("org-1")
    expect(ent.plan).toBe("free")
    expect(ent.status).toBe("none")
  })

  it("returns team plan when subscription.product_id matches POLAR_TEAM_PRODUCT_ID", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        product_id: "prod_team",
        status: "active",
        current_period_end: "2026-05-01T00:00:00Z",
        cancel_at_period_end: false,
      },
      error: null,
    })
    const { getOrganizationEntitlements } = await import(
      "@/lib/billing/entitlements"
    )
    const ent = await getOrganizationEntitlements("org-1")
    expect(ent.plan).toBe("team")
    expect(ent.status).toBe("active")
  })

  it("returns pro plan when subscription matches POLAR_PRO_PRODUCT_ID", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        product_id: "prod_pro",
        status: "trialing",
        current_period_end: null,
        cancel_at_period_end: true,
      },
      error: null,
    })
    const { getOrganizationEntitlements } = await import(
      "@/lib/billing/entitlements"
    )
    const ent = await getOrganizationEntitlements("org-1")
    expect(ent.plan).toBe("pro")
    expect(ent.status).toBe("trialing")
    expect(ent.cancelAtPeriodEnd).toBe(true)
  })
})

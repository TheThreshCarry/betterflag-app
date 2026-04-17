import { describe, expect, it, vi, beforeEach } from "vitest"

const createPolarCustomer = vi.fn()
const upsert = vi.fn()
const from = vi.fn(() => ({ upsert }))

vi.mock("@/lib/polar", () => ({
  polarClient: {
    customers: {
      create: (...args: unknown[]) => createPolarCustomer(...args),
    },
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}))

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

function makeRequest(body: unknown, secret?: string) {
  return new Request("http://localhost/api/auth/hooks/user-created", {
    method: "POST",
    headers: secret ? { "x-shipos-webhook-secret": secret } : {},
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/hooks/user-created", () => {
  beforeEach(() => {
    vi.resetModules()
    createPolarCustomer.mockReset()
    upsert.mockReset()
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "test-secret")
  })

  it("rejects requests with a bad secret", async () => {
    const { POST } = await import(
      "@/app/api/auth/hooks/user-created/route"
    )
    const res = await POST(makeRequest({ id: "u1", email: "a@b.co" }, "wrong"))
    expect(res.status).toBe(401)
  })

  it("rejects when user fields missing", async () => {
    const { POST } = await import(
      "@/app/api/auth/hooks/user-created/route"
    )
    const res = await POST(makeRequest({ record: {} }, "test-secret"))
    expect(res.status).toBe(400)
  })

  it("creates a Polar customer and upserts the mapping row", async () => {
    createPolarCustomer.mockResolvedValue({ id: "cust_123" })
    upsert.mockResolvedValue({ error: null })

    const { POST } = await import(
      "@/app/api/auth/hooks/user-created/route"
    )
    const res = await POST(
      makeRequest(
        { record: { id: "u1", email: "a@b.co", raw_user_meta_data: { name: "A" } } },
        "test-secret",
      ),
    )

    expect(res.status).toBe(200)
    expect(createPolarCustomer).toHaveBeenCalledWith({
      email: "a@b.co",
      externalId: "u1",
      name: "A",
    })
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "u1",
        polar_customer_id: "cust_123",
        organization_id: null,
      },
      { onConflict: "user_id" },
    )
  })

  it("returns 500 when Polar fails", async () => {
    createPolarCustomer.mockRejectedValue(new Error("boom"))
    const { POST } = await import(
      "@/app/api/auth/hooks/user-created/route"
    )
    const res = await POST(
      makeRequest({ record: { id: "u1", email: "a@b.co" } }, "test-secret"),
    )
    expect(res.status).toBe(500)
  })
})

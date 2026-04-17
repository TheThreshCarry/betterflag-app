import { describe, it, expect, vi, beforeEach } from "vitest"

describe("log-context", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("sessionLogBindings includes user and org fields", async () => {
    const { sessionLogBindings } = await import("@/lib/log-context")
    const bindings = sessionLogBindings({
      userId: "u1",
      email: "a@b.co",
      organizationId: "o1",
      organizationRole: "admin",
      isSuperAdmin: false,
    })
    expect(bindings).toEqual({
      userId: "u1",
      userEmail: "a@b.co",
      organizationId: "o1",
      organizationRole: "admin",
      isSuperAdmin: false,
    })
  })

  it("sessionLogBindings returns empty object when session is null", async () => {
    const { sessionLogBindings } = await import("@/lib/log-context")
    expect(sessionLogBindings(null)).toEqual({})
  })
})

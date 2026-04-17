import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetFeatureFlag } = vi.hoisted(() => ({
  mockGetFeatureFlag: vi.fn(),
}))

vi.mock("@/lib/posthog", () => ({
  default: {
    getFeatureFlag: mockGetFeatureFlag,
  },
}))

import { checkAlphaAccess } from "@/lib/actions/alpha-gate"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("checkAlphaAccess", () => {
  it("returns true when the alpha-access flag is true", async () => {
    mockGetFeatureFlag.mockResolvedValue(true)

    const result = await checkAlphaAccess("allowed@shipos.app")

    expect(result).toBe(true)
    expect(mockGetFeatureFlag).toHaveBeenCalledWith(
      "alpha-access",
      "allowed@shipos.app",
      { personProperties: { email: "allowed@shipos.app" } },
    )
  })

  it('returns true when the alpha-access flag is the string "true"', async () => {
    mockGetFeatureFlag.mockResolvedValue("true")

    const result = await checkAlphaAccess("allowed@shipos.app")

    expect(result).toBe(true)
  })

  it("returns false when the alpha-access flag is false", async () => {
    mockGetFeatureFlag.mockResolvedValue(false)

    const result = await checkAlphaAccess("blocked@example.com")

    expect(result).toBe(false)
  })

  it("returns false when the alpha-access flag is undefined", async () => {
    mockGetFeatureFlag.mockResolvedValue(undefined)

    const result = await checkAlphaAccess("unknown@example.com")

    expect(result).toBe(false)
  })

  it("returns false when the alpha-access flag is a non-true string variant", async () => {
    mockGetFeatureFlag.mockResolvedValue("control")

    const result = await checkAlphaAccess("variant@example.com")

    expect(result).toBe(false)
  })

  it("uses the email as the distinct ID for flag evaluation", async () => {
    mockGetFeatureFlag.mockResolvedValue(true)

    await checkAlphaAccess("test@example.com")

    expect(mockGetFeatureFlag).toHaveBeenCalledWith(
      "alpha-access",
      "test@example.com",
      expect.objectContaining({
        personProperties: { email: "test@example.com" },
      }),
    )
  })
})

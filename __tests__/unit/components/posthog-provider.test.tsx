import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

vi.mock("posthog-js", () => {
  const identify = vi.fn()
  const group = vi.fn()
  const capture = vi.fn()
  const featureFlags = { override: vi.fn() }
  return {
    default: { identify, group, capture, featureFlags },
    __esModule: true,
  }
})

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

import posthog from "posthog-js"
import { PostHogProvider, type BootstrapData } from "@/components/posthog/posthog-provider"

beforeEach(() => {
  vi.clearAllMocks()
})

const baseBootstrap: BootstrapData = {
  userId: "user-1",
  userName: "Test User",
  userEmail: "test@example.com",
  activeOrgId: "org-1",
  activeOrgName: "Test Org",
  activeOrgSlug: "test-org",
}

describe("PostHogProvider", () => {
  it("calls posthog.identify with user data on mount", () => {
    render(
      <PostHogProvider bootstrapData={baseBootstrap}>
        <div>child</div>
      </PostHogProvider>,
    )

    expect(posthog.identify).toHaveBeenCalledWith("user-1", {
      name: "Test User",
      email: "test@example.com",
    })
  })

  it("calls posthog.group with organization data on mount", () => {
    render(
      <PostHogProvider bootstrapData={baseBootstrap}>
        <div>child</div>
      </PostHogProvider>,
    )

    expect(posthog.group).toHaveBeenCalledWith("organization", "org-1", {
      name: "Test Org",
      slug: "test-org",
    })
  })

  it("overrides feature flags when provided", () => {
    const data: BootstrapData = {
      ...baseBootstrap,
      featureFlags: { "beta-feature": true, "new-dashboard": "variant-a" },
    }

    render(
      <PostHogProvider bootstrapData={data}>
        <div>child</div>
      </PostHogProvider>,
    )

    expect(posthog.featureFlags.override).toHaveBeenCalledWith({
      "beta-feature": true,
      "new-dashboard": "variant-a",
    })
  })

  it("does not call identify or group when bootstrapData is null", () => {
    render(
      <PostHogProvider bootstrapData={null}>
        <div>child</div>
      </PostHogProvider>,
    )

    expect(posthog.identify).not.toHaveBeenCalled()
    expect(posthog.group).not.toHaveBeenCalled()
  })

  it("does not call group when activeOrgId is null", () => {
    const data: BootstrapData = {
      ...baseBootstrap,
      activeOrgId: null,
      activeOrgName: null,
      activeOrgSlug: null,
    }

    render(
      <PostHogProvider bootstrapData={data}>
        <div>child</div>
      </PostHogProvider>,
    )

    expect(posthog.identify).toHaveBeenCalled()
    expect(posthog.group).not.toHaveBeenCalled()
  })

  it("captures a pageview on mount", () => {
    render(
      <PostHogProvider bootstrapData={baseBootstrap}>
        <div>child</div>
      </PostHogProvider>,
    )

    expect(posthog.capture).toHaveBeenCalledWith("$pageview", {
      $current_url: expect.stringContaining("/dashboard"),
    })
  })

  it("renders children", () => {
    const { getByText } = render(
      <PostHogProvider bootstrapData={baseBootstrap}>
        <span>Hello</span>
      </PostHogProvider>,
    )

    expect(getByText("Hello")).toBeInTheDocument()
  })
})

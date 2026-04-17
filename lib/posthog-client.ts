import posthog from "posthog-js"

export function useFeatureFlag(key: string): boolean | string | undefined {
  return posthog.getFeatureFlag(key)
}

/** Custom event from client components (org context already set via PostHogProvider). */
export function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    posthog.capture(event, properties)
  } catch {
    // ignore
  }
}

export { posthog }

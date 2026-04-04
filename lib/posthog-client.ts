import posthog from "posthog-js"

export function useFeatureFlag(key: string): boolean | string | undefined {
  return posthog.getFeatureFlag(key)
}

export { posthog }

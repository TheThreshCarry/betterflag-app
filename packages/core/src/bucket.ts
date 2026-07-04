import { murmur3_32 } from "./murmur3";

/**
 * Stable percentage-rollout bucketing: murmur3_32("flagKey:unitId") % 100.
 * A user is in an N% rollout iff their bucket < N, so raising the percentage
 * only ever ADDS users — nobody who has the feature loses it mid-rollout.
 * Frozen vectors live in test/bucket.test.ts; SDKs must reproduce them.
 */
export function bucketFor(flagKey: string, unitId: string): number {
  return murmur3_32(`${flagKey}:${unitId}`) % 100;
}

export function inRollout(flagKey: string, unitId: string, pct: number): boolean {
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return bucketFor(flagKey, unitId) < pct;
}

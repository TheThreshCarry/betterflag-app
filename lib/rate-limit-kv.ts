/**
 * Fixed-window rate limit helpers (aligned with worker KV keys).
 */

export function rateLimitWindowId(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs);
}

export function rateLimitKvKey(keyHash: string, windowId: number): string {
  return `v1::ratelimit::${keyHash}::${windowId}`;
}

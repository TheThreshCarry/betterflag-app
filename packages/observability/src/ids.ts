/**
 * ID + time helpers. Uses only Web-standard globals (`crypto`, `Date`,
 * `performance`) so the same code runs in Cloudflare Workers and Node 20.
 */

/** Random lowercase hex string of `byteLength` bytes (2 hex chars per byte). */
export function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  // Unqualified `crypto` is an ambient global in Workers, the DOM lib, and
  // Node 20 — using `globalThis.crypto` would not typecheck under workers-types.
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 16-byte (32 hex char) OTLP trace id. */
export function newTraceId(): string {
  return randomHex(16);
}

/** 8-byte (16 hex char) OTLP span id. */
export function newSpanId(): string {
  return randomHex(8);
}

/** Current wall-clock time in Unix nanoseconds (millisecond resolution). */
export function epochNanos(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

/** Monotonic clock reading in fractional milliseconds. */
export function monotonicMs(): number {
  return performance.now();
}

/** Convert a fractional-millisecond duration into whole nanoseconds. */
export function msToNanos(ms: number): bigint {
  return BigInt(Math.max(0, Math.round(ms * 1_000_000)));
}

/**
 * FNV-1a 64-bit over the UTF-8 bytes of the input string.
 *
 * Used to pseudonymize user identifiers before they leave the edge, raw
 * user IDs never reach ClickHouse (ClickHouse column: UInt64). Returned as a
 * decimal string because JSON cannot carry a 64-bit integer losslessly.
 */

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

const encoder = new TextEncoder();

export function fnv1a64(input: string): bigint {
  const data = encoder.encode(input);
  let hash = FNV_OFFSET;
  for (const byte of data) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

export function hashUserId(userId: string): string {
  return fnv1a64(userId).toString(10);
}

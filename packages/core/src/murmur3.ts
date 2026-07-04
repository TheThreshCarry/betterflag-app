/**
 * MurmurHash3 x86 32-bit over the UTF-8 bytes of the input string.
 *
 * This is THE bucketing hash for ShipOS. The edge worker and every SDK must
 * produce identical values for identical inputs — see test/murmur3.test.ts
 * for the frozen vectors. Do not swap the encoding (UTF-8, not UTF-16 code
 * units) or the seed handling without a coordinated major version bump
 * across all evaluation surfaces.
 */

const encoder = new TextEncoder();

export function murmur3_32(input: string, seed = 0): number {
  const data = encoder.encode(input);
  const len = data.length;
  const nblocks = len >>> 2;

  let h1 = seed >>> 0;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  for (let i = 0; i < nblocks; i++) {
    const o = i * 4;
    let k1 =
      (data[o]! | (data[o + 1]! << 8) | (data[o + 2]! << 16) | (data[o + 3]! << 24)) >>> 0;

    k1 = Math.imul(k1, c1) >>> 0;
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
    k1 = Math.imul(k1, c2) >>> 0;

    h1 = (h1 ^ k1) >>> 0;
    h1 = ((h1 << 13) | (h1 >>> 19)) >>> 0;
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  const tail = nblocks * 4;
  let k1 = 0;
  switch (len & 3) {
    case 3:
      k1 ^= data[tail + 2]! << 16;
    // falls through
    case 2:
      k1 ^= data[tail + 1]! << 8;
    // falls through
    case 1:
      k1 ^= data[tail]!;
      k1 = Math.imul(k1, c1) >>> 0;
      k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
      k1 = Math.imul(k1, c2) >>> 0;
      h1 = (h1 ^ k1) >>> 0;
  }

  h1 = (h1 ^ len) >>> 0;
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h1 = Math.imul(h1, 0x85ebca6b) >>> 0;
  h1 = (h1 ^ (h1 >>> 13)) >>> 0;
  h1 = Math.imul(h1, 0xc2b2ae35) >>> 0;
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;

  return h1 >>> 0;
}

import { describe, expect, it } from "vitest";
import { murmur3_32 } from "../src/murmur3";

/**
 * Canonical MurmurHash3 x86_32 vectors (SMHasher-verified, widely published).
 * If any of these fail, the implementation is wrong — do NOT update the
 * expected values.
 */
const VECTORS: Array<[input: string, seed: number, expected: number]> = [
  ["", 0x00000000, 0x00000000],
  ["", 0x00000001, 0x514e28b7],
  ["", 0xffffffff, 0x81f16f39],
  ["a", 0x9747b28c, 0x7fa09ea6],
  ["aa", 0x9747b28c, 0x5d211726],
  ["aaa", 0x9747b28c, 0x283e0130],
  ["aaaa", 0x9747b28c, 0x5a97808a],
  ["ab", 0x9747b28c, 0x74875592],
  ["abc", 0x9747b28c, 0xc84a62dd],
  ["abcd", 0x9747b28c, 0xf0478627],
  ["abc", 0x00000000, 0xb3dd93fa],
  ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", 0x00000000, 0xee925b90],
  ["Hello, world!", 0x9747b28c, 0x24884cba],
  // 8 UTF-8 two-byte characters — proves we hash UTF-8 bytes, not UTF-16 units.
  ["ππππππππ", 0x9747b28c, 0xd58063c1],
];

describe("murmur3_32", () => {
  it.each(VECTORS)("hash(%j, seed=%d)", (input, seed, expected) => {
    expect(murmur3_32(input, seed)).toBe(expected >>> 0);
  });

  it("defaults to seed 0", () => {
    expect(murmur3_32("abc")).toBe(murmur3_32("abc", 0));
  });

  it("always returns an unsigned 32-bit integer", () => {
    for (let i = 0; i < 1000; i++) {
      const h = murmur3_32(`input-${i}`, i);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { compareSemver, parseSemver } from "../src/semver";

function cmp(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error(`unparseable: ${a} / ${b}`);
  return compareSemver(pa, pb);
}

describe("parseSemver", () => {
  it("parses plain and v-prefixed versions", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseSemver("v10.0.1")).toMatchObject({ major: 10, patch: 1 });
  });

  it("parses prerelease and ignores build metadata", () => {
    expect(parseSemver("1.0.0-rc.1+build.5")).toMatchObject({ prerelease: ["rc", "1"] });
  });

  it("rejects junk", () => {
    for (const bad of ["1.2", "1", "a.b.c", "", null, 42, "1.2.3.4"]) {
      expect(parseSemver(bad)).toBeNull();
    }
  });
});

describe("compareSemver (spec §11 ordering)", () => {
  it("orders the canonical spec chain", () => {
    const chain = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "2.0.0",
      "2.1.0",
      "2.1.1",
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(cmp(chain[i]!, chain[i + 1]!)).toBeLessThan(0);
      expect(cmp(chain[i + 1]!, chain[i]!)).toBeGreaterThan(0);
    }
  });

  it("treats equal versions as equal regardless of v prefix", () => {
    expect(cmp("v1.2.3", "1.2.3")).toBe(0);
  });

  it("compares numerically, not lexically", () => {
    expect(cmp("2.10.0", "2.9.0")).toBeGreaterThan(0);
  });
});

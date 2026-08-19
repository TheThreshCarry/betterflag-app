import { afterEach, describe, expect, it } from "vitest";

import { polarServer } from "@/lib/polar";

describe("polarServer", () => {
  const prev = process.env.POLAR_SERVER;

  afterEach(() => {
    if (prev === undefined) delete process.env.POLAR_SERVER;
    else process.env.POLAR_SERVER = prev;
  });

  it("accepts production", () => {
    process.env.POLAR_SERVER = "production";
    expect(polarServer()).toBe("production");
  });

  it("accepts sandbox", () => {
    process.env.POLAR_SERVER = "sandbox";
    expect(polarServer()).toBe("sandbox");
  });

  it("rejects unset so we never silently hit Polar sandbox", () => {
    delete process.env.POLAR_SERVER;
    expect(() => polarServer()).toThrow(/POLAR_SERVER/);
  });
});

import { describe, expect, it } from "vitest";
import { stableStringify } from "../src/stable-stringify";

describe("stableStringify", () => {
  it("serializes primitives like JSON.stringify", () => {
    expect(stableStringify("a")).toBe('"a"');
    expect(stableStringify(1.5)).toBe("1.5");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(null)).toBe("null");
  });

  it("returns the empty string for undefined", () => {
    expect(stableStringify(undefined)).toBe("");
  });

  it("sorts object keys at every depth", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(stableStringify({ z: { d: 1, c: [{ b: 2, a: 1 }] }, a: 0 })).toBe(
      '{"a":0,"z":{"c":[{"a":1,"b":2}],"d":1}}',
    );
  });

  it("produces identical output for structurally equal values", () => {
    const left = { user: { plan: "pro", beta: true }, region: "eu" };
    const right = { region: "eu", user: { beta: true, plan: "pro" } };
    expect(stableStringify(left)).toBe(stableStringify(right));
  });

  it("preserves array order", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });
});

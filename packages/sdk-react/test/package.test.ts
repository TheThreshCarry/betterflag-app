import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };

describe("published entry points", () => {
  it("points Node at dist, not src (bun publish does not apply publishConfig.exports)", () => {
    expect(pkg.exports["."].import).toBe("./dist/index.js");
    expect("bun" in pkg.exports["."]).toBe(false);
  });
});

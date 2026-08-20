import { describe, expect, it } from "vitest";

import { SDK_VERSION } from "../src/index";
import pkg from "../package.json" with { type: "json" };

describe("published entry points", () => {
  it("keeps package version in sync with the SDK header", () => {
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it("points Node at dist, not src (bun publish does not apply publishConfig.exports)", () => {
    expect(pkg.exports["."].import).toBe("./dist/index.js");
    expect(pkg.exports["."].require).toBe("./dist/index.cjs");
    expect("bun" in pkg.exports["."]).toBe(false);
  });
});

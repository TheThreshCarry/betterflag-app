import { describe, expect, it } from "vitest";
import { apiRouteScopeFromPath, isApiScopeAllowed } from "@/lib/api-scope";

describe("apiRouteScopeFromPath", () => {
  it("returns first segment after /v1/", () => {
    expect(apiRouteScopeFromPath("/v1/flags")).toBe("flags");
    expect(apiRouteScopeFromPath("/v1/config/pricing")).toBe("config");
    expect(apiRouteScopeFromPath("/v1/media/upload")).toBe("media");
  });

  it("returns null for non-v1 paths", () => {
    expect(apiRouteScopeFromPath("/health")).toBeNull();
    expect(apiRouteScopeFromPath("/internal/kv/x")).toBeNull();
  });
});

describe("isApiScopeAllowed", () => {
  it("allows any path when permissions are empty or missing", () => {
    expect(isApiScopeAllowed("/v1/flags", undefined)).toBe(true);
    expect(isApiScopeAllowed("/v1/flags", [])).toBe(true);
  });

  it("always allows controllers discovery", () => {
    expect(isApiScopeAllowed("/v1/controllers", ["flags"])).toBe(true);
  });

  it("allows when scope is in permissions", () => {
    expect(isApiScopeAllowed("/v1/flags", ["flags", "config"])).toBe(true);
    expect(isApiScopeAllowed("/v1/config/x", ["config"])).toBe(true);
  });

  it("denies when scope is not in permissions", () => {
    expect(isApiScopeAllowed("/v1/media/upload", ["flags"])).toBe(false);
  });

  it("allows non-v1 paths (no scope)", () => {
    expect(isApiScopeAllowed("/health", ["flags"])).toBe(true);
  });
});

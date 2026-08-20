import { afterEach, describe, expect, it } from "vitest";

import {
  REQUIRED_DASHBOARD_ENV,
  assertRequiredDashboardEnv,
  shouldAssertDashboardEnv,
} from "@/lib/env";

describe("shouldAssertDashboardEnv", () => {
  it("skips vitest, test, edge, and next build phases", () => {
    expect(shouldAssertDashboardEnv({ VITEST: "true" })).toBe(false);
    expect(shouldAssertDashboardEnv({ NODE_ENV: "test" })).toBe(false);
    expect(shouldAssertDashboardEnv({ NEXT_RUNTIME: "edge" })).toBe(false);
    expect(shouldAssertDashboardEnv({ NEXT_PHASE: "phase-production-build" })).toBe(false);
    expect(shouldAssertDashboardEnv({ NEXT_PHASE: "phase-development-build" })).toBe(false);
  });

  it("runs at Node boot", () => {
    expect(shouldAssertDashboardEnv({ NODE_ENV: "production" })).toBe(true);
    expect(shouldAssertDashboardEnv({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("assertRequiredDashboardEnv", () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const name of REQUIRED_DASHBOARD_ENV) {
      if (prev[name] === undefined) delete process.env[name];
      else process.env[name] = prev[name];
    }
  });

  it("throws listing every missing key", () => {
    for (const name of REQUIRED_DASHBOARD_ENV) {
      prev[name] = process.env[name];
      delete process.env[name];
    }
    expect(() => assertRequiredDashboardEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => assertRequiredDashboardEnv({})).toThrow(/MCP_OAUTH_SHARED_SECRET/);
  });

  it("rejects Polar server values other than production|sandbox", () => {
    const env: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      POLAR_ACCESS_TOKEN: "polar",
      POLAR_SERVER: "prod",
      MCP_OAUTH_SHARED_SECRET: "secret",
    };
    expect(() => assertRequiredDashboardEnv(env)).toThrow(/POLAR_SERVER/);
  });

  it("accepts a complete production bag", () => {
    const env: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      POLAR_ACCESS_TOKEN: "polar",
      POLAR_SERVER: "production",
      MCP_OAUTH_SHARED_SECRET: "secret",
    };
    expect(() => assertRequiredDashboardEnv(env)).not.toThrow();
  });
});

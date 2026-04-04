import { describe, expect, it, afterEach } from "vitest";
import { workerServiceHeaders } from "@/lib/worker-internal";

describe("workerServiceHeaders", () => {
  const orig = process.env.SERVICE_SECRET;

  afterEach(() => {
    if (orig === undefined) delete process.env.SERVICE_SECRET;
    else process.env.SERVICE_SECRET = orig;
  });

  it("throws when SERVICE_SECRET is missing", () => {
    delete process.env.SERVICE_SECRET;
    expect(() => workerServiceHeaders()).toThrow("SERVICE_SECRET is not configured");
  });

  it("returns x-service-secret and merges extra headers", () => {
    process.env.SERVICE_SECRET = "test-secret";
    const h = workerServiceHeaders({ "Content-Type": "application/json" });
    expect(h["x-service-secret"]).toBe("test-secret");
    expect(h["Content-Type"]).toBe("application/json");
  });
});

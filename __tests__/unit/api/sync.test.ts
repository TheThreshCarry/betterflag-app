import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.stubEnv("WORKER_API_URL", "http://worker.test");
vi.stubEnv("SERVICE_SECRET", "svc-secret");
vi.stubEnv("SYNC_WEBHOOK_SECRET", "sync-secret");

const { POST, PUT } = await import("@/app/api/sync/route");

function makeRequest(
  method: string,
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost:3000/api/sync", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects unauthorized requests", async () => {
    const res = await POST(makeRequest("POST", {}));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("INVALID_SECRET");
  });

  it("rejects requests with wrong secret", async () => {
    const res = await POST(makeRequest("POST", {}, { "x-sync-secret": "wrong" }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid payload", async () => {
    const res = await POST(
      makeRequest("POST", { type: "flags" }, { "x-sync-secret": "sync-secret" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects upsert without value", async () => {
    const res = await POST(
      makeRequest(
        "POST",
        { type: "flags", action: "upsert", key: "k1" },
        { "x-sync-secret": "sync-secret" }
      )
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("MISSING_VALUE");
  });

  it("successfully upserts to KV", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const res = await POST(
      makeRequest(
        "POST",
        { type: "flags", action: "upsert", key: "k1", value: { enabled: true } },
        { "x-sync-secret": "sync-secret" }
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("upsert");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://worker.test/internal/kv/k1",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "x-service-secret": "svc-secret",
        }),
      })
    );
  });

  it("encodes KV key in URL for special characters", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const key = "v1::apikey_h::abc::extra";
    await POST(
      makeRequest(
        "POST",
        { type: "flags", action: "upsert", key, value: true },
        { "x-sync-secret": "sync-secret" }
      )
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `http://worker.test/internal/kv/${encodeURIComponent(key)}`,
      expect.anything()
    );
  });

  it("successfully deletes from KV", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const res = await POST(
      makeRequest(
        "POST",
        { type: "flags", action: "delete", key: "k1" },
        { "x-sync-secret": "sync-secret" }
      )
    );
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("delete");
  });

  it("rejects invalid action", async () => {
    const res = await POST(
      makeRequest(
        "POST",
        { type: "flags", action: "purge", key: "k1" },
        { "x-sync-secret": "sync-secret" }
      )
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ACTION");
  });

  it("returns 500 when KV write fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "KV error" });
    vi.stubGlobal("fetch", mockFetch);

    const res = await POST(
      makeRequest(
        "POST",
        { type: "flags", action: "upsert", key: "k1", value: true },
        { "x-sync-secret": "sync-secret" }
      )
    );
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/sync (batch)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects unauthorized requests", async () => {
    const res = await PUT(makeRequest("PUT", []));
    expect(res.status).toBe(401);
  });

  it("rejects non-array payload", async () => {
    const res = await PUT(
      makeRequest("PUT", { not: "an array" }, { "x-sync-secret": "sync-secret" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty array", async () => {
    const res = await PUT(makeRequest("PUT", [], { "x-sync-secret": "sync-secret" }));
    expect(res.status).toBe(400);
  });

  it("processes batch upserts", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const res = await PUT(
      makeRequest(
        "PUT",
        [
          { type: "flags", action: "upsert", key: "k1", value: true },
          { type: "flags", action: "delete", key: "k2" },
        ],
        { "x-sync-secret": "sync-secret" }
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(2);
  });
});

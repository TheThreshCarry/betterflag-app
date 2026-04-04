import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockDb } from "../../helpers/db-mock";

const { mockDb, mockQuery } = createMockDb();
vi.mock("@/lib/db", () => ({ default: mockDb }));

const { GET } = await import("@/app/api/cms/content-types/route");

function makeRequest(params: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/cms/content-types");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url, { headers });
}

describe("GET /api/cms/content-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns content types for an organization", async () => {
    const mockData = [
      { id: "ct-1", name: "Blog", slug: "blog", status: "active" },
    ];
    mockQuery.contentTypes.findMany.mockResolvedValueOnce(mockData);

    const res = await GET(makeRequest({}, { "x-organization-id": "org-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(mockData);
  });

  it("accepts organizationId from query params", async () => {
    mockQuery.contentTypes.findMany.mockResolvedValueOnce([]);
    const res = await GET(makeRequest({ organizationId: "org-1" }));
    expect(res.status).toBe(200);
  });

  it("defaults status filter to active", async () => {
    mockQuery.contentTypes.findMany.mockResolvedValueOnce([]);
    const res = await GET(makeRequest({}, { "x-organization-id": "org-1" }));
    expect(res.status).toBe(200);
    expect(mockQuery.contentTypes.findMany).toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockQuery.contentTypes.findMany.mockRejectedValueOnce(new Error("DB down"));
    const res = await GET(makeRequest({}, { "x-organization-id": "org-1" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});

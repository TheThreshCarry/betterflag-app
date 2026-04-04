import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { getTestDb, cleanDatabase, closeTestDb } from "../helpers/test-db";
import { contentTypes } from "@/lib/db/schema";

const db = getTestDb();
const TEST_ORG = "integ-test-org";

vi.mock("@/lib/db", () => ({ default: db }));

const { GET } = await import("@/app/api/cms/content-types/route");

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

function makeRequest(headers: Record<string, string> = {}, params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/cms/content-types");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url, { headers });
}

describe("GET /api/cms/content-types (integration)", () => {
  it("returns seeded content types", async () => {
    await db.insert(contentTypes).values([
      {
        name: "Blog",
        slug: "blog",
        status: "active",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      },
      {
        name: "Page",
        slug: "page",
        status: "active",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      },
    ]);

    const res = await GET(new (await import("next/server")).NextRequest(
      "http://localhost:3000/api/cms/content-types",
      { headers: { "x-organization-id": TEST_ORG } }
    ));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
  });

  it("filters by status param", async () => {
    await db.insert(contentTypes).values([
      {
        name: "Active",
        slug: "active-ct",
        status: "active",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      },
      {
        name: "Draft",
        slug: "draft-ct",
        status: "draft",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      },
    ]);

    const res = await GET(new (await import("next/server")).NextRequest(
      "http://localhost:3000/api/cms/content-types?status=draft",
      { headers: { "x-organization-id": TEST_ORG } }
    ));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].slug).toBe("draft-ct");
  });

  it("returns empty array for org with no content types", async () => {
    const res = await GET(new (await import("next/server")).NextRequest(
      "http://localhost:3000/api/cms/content-types",
      { headers: { "x-organization-id": "empty-org" } }
    ));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });
});

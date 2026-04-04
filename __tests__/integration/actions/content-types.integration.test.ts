import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDatabase, closeTestDb } from "../helpers/test-db";
import { contentTypes, entries } from "@/lib/db/schema";

const db = getTestDb();
const TEST_ORG = "integ-test-org";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

describe("content types CRUD (integration)", () => {
  it("creates a content type with schema", async () => {
    const [ct] = await db
      .insert(contentTypes)
      .values({
        name: "Blog Post",
        slug: "blog-post",
        organizationId: TEST_ORG,
        schema: {
          version: 2,
          fields: [
            { uid: "f_1", name: "title", type: "text", required: true },
            { uid: "f_2", name: "body", type: "richtext", required: false },
          ],
        },
      })
      .returning();

    expect(ct.id).toBeDefined();
    expect(ct.slug).toBe("blog-post");
    expect(ct.version).toBe(1);

    const found = await db.query.contentTypes.findFirst({
      where: eq(contentTypes.id, ct.id),
    });
    expect(found?.name).toBe("Blog Post");
    expect((found?.schema as any).version).toBe(2);
    expect((found?.schema as any).fields).toHaveLength(2);
  });

  it("updates a content type schema version", async () => {
    const [ct] = await db
      .insert(contentTypes)
      .values({
        name: "Article",
        slug: "article",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      })
      .returning();

    const [updated] = await db
      .update(contentTypes)
      .set({
        version: 2,
        schema: {
          version: 2,
          fields: [{ uid: "f_1", name: "headline", type: "text" }],
        },
      })
      .where(eq(contentTypes.id, ct.id))
      .returning();

    expect(updated.version).toBe(2);
  });

  it("cascades delete to entries", async () => {
    const [ct] = await db
      .insert(contentTypes)
      .values({
        name: "Page",
        slug: "page",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      })
      .returning();

    await db.insert(entries).values({
      contentTypeId: ct.id,
      slug: "home",
      organizationId: TEST_ORG,
      data: { title: "Home" },
    });

    await db.delete(contentTypes).where(eq(contentTypes.id, ct.id));

    const orphanedEntries = await db.query.entries.findMany({
      where: eq(entries.contentTypeId, ct.id),
    });
    expect(orphanedEntries).toHaveLength(0);
  });
});

describe("entries CRUD (integration)", () => {
  it("creates and queries entries for a content type", async () => {
    const [ct] = await db
      .insert(contentTypes)
      .values({
        name: "Product",
        slug: "product",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      })
      .returning();

    await db.insert(entries).values([
      { contentTypeId: ct.id, slug: "widget", organizationId: TEST_ORG, data: { name: "Widget" } },
      { contentTypeId: ct.id, slug: "gadget", organizationId: TEST_ORG, data: { name: "Gadget" } },
    ]);

    const results = await db.query.entries.findMany({
      where: eq(entries.contentTypeId, ct.id),
    });
    expect(results).toHaveLength(2);
  });

  it("enforces unique slug per org + content type", async () => {
    const [ct] = await db
      .insert(contentTypes)
      .values({
        name: "FAQ",
        slug: "faq",
        organizationId: TEST_ORG,
        schema: { version: 2, fields: [] },
      })
      .returning();

    await db.insert(entries).values({
      contentTypeId: ct.id,
      slug: "duplicate",
      organizationId: TEST_ORG,
      data: {},
    });

    await expect(
      db.insert(entries).values({
        contentTypeId: ct.id,
        slug: "duplicate",
        organizationId: TEST_ORG,
        data: {},
      })
    ).rejects.toThrow();
  });
});

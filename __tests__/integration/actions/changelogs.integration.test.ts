import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDatabase, closeTestDb } from "../helpers/test-db";
import { changelogs, changelogLabels, changelogLabelAssignments } from "@/lib/db/schema";

const db = getTestDb();
const TEST_ORG = "integ-test-org";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

describe("changelogs CRUD (integration)", () => {
  it("creates and retrieves a changelog", async () => {
    const [cl] = await db
      .insert(changelogs)
      .values({
        title: "v1.0.0",
        slug: "v1-0-0",
        version: "1.0.0",
        status: "draft",
        organizationId: TEST_ORG,
        authorId: "user-1",
      })
      .returning();

    expect(cl.id).toBeDefined();
    expect(cl.status).toBe("draft");

    const found = await db.query.changelogs.findFirst({
      where: eq(changelogs.id, cl.id),
    });
    expect(found?.title).toBe("v1.0.0");
  });

  it("publishes a changelog (updates status and publishedAt)", async () => {
    const [cl] = await db
      .insert(changelogs)
      .values({
        title: "v2.0.0",
        slug: "v2-0-0",
        status: "draft",
        organizationId: TEST_ORG,
      })
      .returning();

    const [published] = await db
      .update(changelogs)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(changelogs.id, cl.id))
      .returning();

    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeDefined();
  });

  it("assigns labels to a changelog", async () => {
    const [cl] = await db
      .insert(changelogs)
      .values({
        title: "Release",
        slug: "release",
        status: "draft",
        organizationId: TEST_ORG,
      })
      .returning();

    const [label1] = await db
      .insert(changelogLabels)
      .values({ name: "Feature", color: "#00ff00", organizationId: TEST_ORG })
      .returning();
    const [label2] = await db
      .insert(changelogLabels)
      .values({ name: "Bugfix", color: "#ff0000", organizationId: TEST_ORG })
      .returning();

    await db.insert(changelogLabelAssignments).values([
      { changelogId: cl.id, labelId: label1.id },
      { changelogId: cl.id, labelId: label2.id },
    ]);

    const assignments = await db.query.changelogLabelAssignments.findMany({
      where: eq(changelogLabelAssignments.changelogId, cl.id),
    });
    expect(assignments).toHaveLength(2);
  });

  it("deletes changelog and its label assignments", async () => {
    const [cl] = await db
      .insert(changelogs)
      .values({
        title: "To Delete",
        slug: "to-delete",
        status: "draft",
        organizationId: TEST_ORG,
      })
      .returning();

    const [label] = await db
      .insert(changelogLabels)
      .values({ name: "Temp", color: "#999999", organizationId: TEST_ORG })
      .returning();

    await db
      .insert(changelogLabelAssignments)
      .values({ changelogId: cl.id, labelId: label.id });

    await db
      .delete(changelogLabelAssignments)
      .where(eq(changelogLabelAssignments.changelogId, cl.id));
    await db.delete(changelogs).where(eq(changelogs.id, cl.id));

    const found = await db.query.changelogs.findFirst({
      where: eq(changelogs.id, cl.id),
    });
    expect(found).toBeUndefined();

    const orphanedAssignments = await db.query.changelogLabelAssignments.findMany({
      where: eq(changelogLabelAssignments.changelogId, cl.id),
    });
    expect(orphanedAssignments).toHaveLength(0);
  });
});

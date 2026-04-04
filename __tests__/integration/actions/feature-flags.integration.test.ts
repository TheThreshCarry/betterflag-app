import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDatabase, closeTestDb } from "../helpers/test-db";
import { featureFlags } from "@/lib/db/schema";

const db = getTestDb();
const TEST_ORG = "integ-test-org";

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeTestDb();
});

describe("feature flags CRUD (integration)", () => {
  it("inserts and retrieves a feature flag", async () => {
    const [created] = await db
      .insert(featureFlags)
      .values({
        key: "dark-mode",
        name: "Dark Mode",
        enabled: false,
        environment: "production",
        organizationId: TEST_ORG,
      })
      .returning();

    expect(created.id).toBeDefined();
    expect(created.key).toBe("dark-mode");
    expect(created.enabled).toBe(false);

    const found = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.id, created.id),
    });
    expect(found).toBeDefined();
    expect(found?.key).toBe("dark-mode");
  });

  it("updates a feature flag", async () => {
    const [created] = await db
      .insert(featureFlags)
      .values({
        key: "beta",
        name: "Beta",
        enabled: false,
        environment: "staging",
        organizationId: TEST_ORG,
      })
      .returning();

    const [updated] = await db
      .update(featureFlags)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(featureFlags.id, created.id))
      .returning();

    expect(updated.enabled).toBe(true);
  });

  it("deletes a feature flag", async () => {
    const [created] = await db
      .insert(featureFlags)
      .values({
        key: "temp-flag",
        name: "Temp",
        enabled: true,
        environment: "production",
        organizationId: TEST_ORG,
      })
      .returning();

    await db.delete(featureFlags).where(eq(featureFlags.id, created.id));

    const found = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.id, created.id),
    });
    expect(found).toBeUndefined();
  });

  it("filters flags by organization and environment", async () => {
    await db.insert(featureFlags).values([
      { key: "a", name: "A", enabled: true, environment: "production", organizationId: TEST_ORG },
      { key: "b", name: "B", enabled: false, environment: "staging", organizationId: TEST_ORG },
      { key: "c", name: "C", enabled: true, environment: "production", organizationId: "other-org" },
    ]);

    const prodFlags = await db.query.featureFlags.findMany({
      where: (flags, { eq, and }) =>
        and(
          eq(flags.organizationId, TEST_ORG),
          eq(flags.environment, "production")
        ),
    });

    expect(prodFlags).toHaveLength(1);
    expect(prodFlags[0].key).toBe("a");
  });
});

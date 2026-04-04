import { describe, it, expect, afterAll } from "vitest";
import { getTestDb, closeTestDb } from "../helpers/test-db";
import { sql } from "drizzle-orm";

const db = getTestDb();

afterAll(async () => {
  await closeTestDb();
});

describe("database migrations", () => {
  it("has applied migrations (tables exist)", async () => {
    const result = await db.execute(sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const tables = result.rows.map((r: any) => r.tablename);
    expect(tables).toContain("feature_flags");
    expect(tables).toContain("changelogs");
    expect(tables).toContain("content_types");
    expect(tables).toContain("entries");
    expect(tables).toContain("media_assets");
    expect(tables).toContain("user");
    expect(tables).toContain("session");
  });

  it("feature_flags table has expected columns", async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'feature_flags'
      ORDER BY ordinal_position
    `);
    const columns = result.rows.map((r: any) => r.column_name);
    expect(columns).toContain("id");
    expect(columns).toContain("key");
    expect(columns).toContain("name");
    expect(columns).toContain("enabled");
    expect(columns).toContain("environment");
    expect(columns).toContain("organization_id");
  });

  it("content_types table has expected columns", async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'content_types'
      ORDER BY ordinal_position
    `);
    const columns = result.rows.map((r: any) => r.column_name);
    expect(columns).toContain("id");
    expect(columns).toContain("name");
    expect(columns).toContain("slug");
    expect(columns).toContain("version");
    expect(columns).toContain("status");
    expect(columns).toContain("schema");
  });

  it("drizzle migration tracking exists", async () => {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = '__drizzle_migrations'
    `);
    expect(Number(result.rows[0].count)).toBeGreaterThan(0);
  });

  it("apikey table has organization_id for edge KV resolution", async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'apikey' AND column_name = 'organization_id'
    `);
    expect(result.rows.length).toBe(1);
  });
});

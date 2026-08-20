import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, "../supabase/migrations/20260820110000_email_templates.sql"),
  "utf8",
);

describe("ITR-189 email_templates", () => {
  it("is idempotent and seeds empty compiled_html for lifecycle fallback", () => {
    expect(migration).toContain("create table if not exists public.email_templates");
    expect(migration).toContain("on conflict (key) do nothing");
    expect(migration.match(/compiled_html/g)?.length).toBeGreaterThan(1);
    expect(migration).toMatch(/'\s*'\s*\n\s*\)\s*,\s*\n\s*\(/);
  });
});

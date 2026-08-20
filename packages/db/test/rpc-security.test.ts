import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, "../supabase/migrations/20260820100000_rpc_execute_revoke.sql"),
  "utf8",
);

const MUTATORS = [
  "record_audit",
  "create_project_with_envs",
  "create_flag_with_configs",
  "update_flag_config",
  "kill_flag",
];

describe("ITR-186 RPC grants", () => {
  it("revokes EXECUTE on every mutator from public, anon, and authenticated", () => {
    for (const name of MUTATORS) {
      expect(migration).toMatch(
        new RegExp(`revoke execute on function public\\.${name}\\([^)]+\\) from public, anon, authenticated;`),
      );
    }
  });

  it("grants EXECUTE on every mutator to service_role", () => {
    for (const name of MUTATORS) {
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^)]+\\) to service_role;`),
      );
    }
  });

  it("does not revoke is_org_member (RLS needs it for authenticated reads)", () => {
    expect(migration).not.toMatch(/revoke execute on function public\.is_org_member/);
  });

  it("blocks user JWTs via require_org_member while allowing null auth.uid()", () => {
    expect(migration).toContain("auth.uid() is not null and not public.is_org_member(p_org)");
    expect(migration).toContain("errcode = '42501'");
    for (const name of MUTATORS) {
      expect(migration).toContain(`create or replace function public.${name}(`);
      expect(migration).toMatch(/perform public\.require_org_member\(/);
    }
  });
});

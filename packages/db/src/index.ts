/**
 * Hand-written row types matching supabase/migrations. Replace with
 * generated types (`pnpm gen-types`) once the migration is applied to a
 * linked Supabase project — the shapes must stay identical.
 */

import type { JsonValue } from "@shipos/core";

export type OrgPlan = "trial" | "starter" | "launch" | "scale";
export type OrgRole = "owner" | "admin" | "member";
export type FlagKindDb = "boolean" | "string" | "number" | "json";
export type ApiKeyKindDb = "sdk" | "agent" | "admin";
export type ActorTypeDb = "user" | "agent";

export interface OrgRow {
  id: string;
  name: string;
  plan: OrgPlan;
  stripe_customer_id: string | null;
  trial_ends_at: string;
  usage_cache: JsonValue;
  created_at: string;
}

export interface OrgMemberRow {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface EnvironmentRow {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface FlagRow {
  id: string;
  project_id: string;
  key: string;
  name: string;
  description: string;
  kind: FlagKindDb;
  default_value: JsonValue;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FlagConfigRow {
  id: string;
  flag_id: string;
  environment_id: string;
  enabled: boolean;
  killed: boolean;
  rollout_pct: number;
  rules: JsonValue;
  value_on: JsonValue | null;
  value_off: JsonValue | null;
  version: number;
  updated_at: string;
  updated_by: string | null;
  updated_by_key_prefix: string | null;
}

export interface ApiKeyRow {
  id: string;
  org_id: string;
  project_id: string | null;
  environment_id: string | null;
  kind: ApiKeyKindDb;
  name: string;
  hash: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface AuditLogRow {
  id: number;
  org_id: string;
  project_id: string | null;
  actor_type: ActorTypeDb;
  actor_id: string | null;
  actor_key_prefix: string | null;
  action: string;
  subject: string;
  before: JsonValue | null;
  after: JsonValue | null;
  created_at: string;
}

/** Plan limits enforced in app logic (evaluations are metered, never blocked here). */
export const PLAN_LIMITS: Record<
  OrgPlan,
  { projects: number | null; agentKeys: number | null; includedEvalsPerMonth: number }
> = {
  // Trial gets Launch-shaped limits so the trial demonstrates the product.
  trial: { projects: 3, agentKeys: 5, includedEvalsPerMonth: 10_000_000 },
  starter: { projects: 1, agentKeys: 1, includedEvalsPerMonth: 2_000_000 },
  launch: { projects: 3, agentKeys: 5, includedEvalsPerMonth: 10_000_000 },
  scale: { projects: null, agentKeys: null, includedEvalsPerMonth: 100_000_000 },
};

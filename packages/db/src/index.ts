/**
 * Hand-written row types matching supabase/migrations. Replace with
 * generated types (`pnpm gen-types`) once the migration is applied to a
 * linked Supabase project, the shapes must stay identical.
 */

import type { JsonValue } from "@betterflag/core";

export type OrgPlan = "trial" | "starter" | "launch" | "scale";
export type OrgRole = "owner" | "admin" | "member";
export type FlagKindDb = "boolean" | "string" | "number" | "json";
export type ApiKeyKindDb = "sdk" | "agent" | "admin";
/** 'manual' = Keys page; 'oauth' = minted by an approved MCP OAuth connection. */
export type ApiKeySourceDb = "manual" | "oauth";
export type ActorTypeDb = "user" | "agent";

export interface OrgRow {
  id: string;
  name: string;
  plan: OrgPlan;
  stripe_customer_id: string | null;
  trial_ends_at: string;
  usage_cache: JsonValue;
  created_at: string;
  // Billing state synced from Polar webhooks (migration 20260707140000).
  polar_customer_id: string | null;
  polar_subscription_id: string | null;
  /** Raw Polar subscription status (e.g. active, past_due, canceled). */
  subscription_status: string | null;
  /** When the subscription first went past_due; drives the grace window. */
  past_due_since: string | null;
  /** Timestamp of the last Polar event applied (out-of-order guard). */
  billing_synced_at: string | null;
  /** Super-admin freeze (migration 20260718090000). Null = active. */
  frozen_at: string | null;
  /** Public logo URL on media CDN (migration 20260725180000). */
  logo_url: string | null;
}

/** Private-alpha allowlist (migration 20260709100000). Service-role only. */
export interface AlphaAllowlistRow {
  email: string;
  note: string | null;
  created_at: string;
}

/** 1:1 with auth.users (migration 20260725190000). */
export interface ProfileRow {
  id: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
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
  /** Public picture URL on media CDN (migration 20260725180000). */
  picture_url: string | null;
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
  source: ApiKeySourceDb;
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
  // Agent keys are unlimited on every plan (not a plan metric). Only Starter
  // caps projects. Trial gets Launch-shaped limits so it demonstrates the
  // product.
  trial: { projects: null, agentKeys: null, includedEvalsPerMonth: 5_000_000 },
  starter: { projects: 3, agentKeys: null, includedEvalsPerMonth: 1_000_000 },
  launch: { projects: null, agentKeys: null, includedEvalsPerMonth: 5_000_000 },
  scale: { projects: null, agentKeys: null, includedEvalsPerMonth: 50_000_000 },
};

/**
 * Analytics retention per plan, in days: how long evaluation-level analytics
 * data is kept in total before deletion. The first 7 days are always hot in
 * ClickHouse (raw-table TTL); after that, days live as gzipped NDJSON in R2
 * until this window expires (ingest worker cron). Retention is a plan
 * feature, not a per-org setting. Trial mirrors Launch, like PLAN_LIMITS.
 */
export const ANALYTICS_HOT_DAYS = 7;

export const ANALYTICS_RETENTION_DAYS: Record<OrgPlan, number> = {
  trial: 90,
  starter: 30,
  launch: 90,
  scale: 365,
};

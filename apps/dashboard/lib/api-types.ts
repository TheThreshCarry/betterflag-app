/**
 * Wire shapes for /api/v1 responses (camelCase), shared by route handlers
 * and the dashboard UI. Serializers map DB rows → wire shapes; `hash` is
 * never serialized.
 */

import type { JsonValue } from "@shipos/core";

import { billingDecisionForOrg } from "@/lib/billing-status";
import type {
  ApiKeyRow,
  AuditLogRow,
  ActorTypeDb,
  ApiKeyKindDb,
  ApiKeySourceDb,
  EnvironmentRow,
  FlagConfigRow,
  FlagKindDb,
  FlagRow,
  OrgPlan,
  OrgRole,
  OrgRow,
  ProjectRow,
} from "@shipos/db";

export interface ApiEnvironment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ApiProject {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  createdAt: string;
  environments: ApiEnvironment[];
}

export interface ApiFlag {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description: string;
  kind: FlagKindDb;
  defaultValue: JsonValue;
  archivedAt: string | null;
  createdAt: string;
}

export interface ApiFlagConfig {
  id: string;
  flagId: string;
  environmentId: string;
  enabled: boolean;
  killed: boolean;
  rolloutPct: number;
  rules: JsonValue;
  valueOn: JsonValue | null;
  valueOff: JsonValue | null;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  updatedByKeyPrefix: string | null;
}

export type ApiFlagConfigWithEnv = ApiFlagConfig & { environment: ApiEnvironment };

export interface ApiApiKey {
  id: string;
  orgId: string;
  projectId: string | null;
  environmentId: string | null;
  kind: ApiKeyKindDb;
  name: string;
  prefix: string;
  scopes: string[];
  source: ApiKeySourceDb;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface ApiAuditEntry {
  id: number;
  orgId: string;
  projectId: string | null;
  actorType: ActorTypeDb;
  actorId: string | null;
  actorKeyPrefix: string | null;
  action: string;
  subject: string;
  before: JsonValue | null;
  after: JsonValue | null;
  createdAt: string;
}

export interface ApiOrgMember {
  userId: string;
  role: OrgRole;
  email: string | null;
  createdAt: string;
}

export interface ApiOrg {
  id: string;
  name: string;
  plan: OrgPlan;
  trialEndsAt: string;
  createdAt: string;
  role: OrgRole;
  members?: ApiOrgMember[];
  /** True when billing has flipped the account read-only (flags still serve). */
  restricted: boolean;
  /** Human-readable billing status line for banners. */
  billingMessage: string;
}

export interface UsagePoint {
  day: string;
  evaluations: number;
}

export interface ApiUsage {
  plan: OrgPlan;
  trialEndsAt: string;
  includedEvalsPerMonth: number;
  used: number;
  series: UsagePoint[];
}

export interface StatsPoint {
  hour: string;
  variation: string;
  evaluations: number;
}

export interface ApiStats {
  period: "24h" | "7d" | "30d";
  series: StatsPoint[];
}

// ── Serializers ──────────────────────────────────────────────────────────────

export function toApiEnvironment(row: EnvironmentRow): ApiEnvironment {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  };
}

export function toApiProject(row: ProjectRow, environments: EnvironmentRow[]): ApiProject {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
    environments: environments.map(toApiEnvironment),
  };
}

export function toApiFlag(row: FlagRow): ApiFlag {
  return {
    id: row.id,
    projectId: row.project_id,
    key: row.key,
    name: row.name,
    description: row.description,
    kind: row.kind,
    defaultValue: row.default_value,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function toApiFlagConfig(row: FlagConfigRow): ApiFlagConfig {
  return {
    id: row.id,
    flagId: row.flag_id,
    environmentId: row.environment_id,
    enabled: row.enabled,
    killed: row.killed,
    rolloutPct: row.rollout_pct,
    rules: row.rules,
    valueOn: row.value_on,
    valueOff: row.value_off,
    version: row.version,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByKeyPrefix: row.updated_by_key_prefix,
  };
}

export function toApiApiKey(row: ApiKeyRow): ApiApiKey {
  return {
    id: row.id,
    orgId: row.org_id,
    projectId: row.project_id,
    environmentId: row.environment_id,
    kind: row.kind,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    source: row.source,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

export function toApiAuditEntry(row: AuditLogRow): ApiAuditEntry {
  return {
    id: row.id,
    orgId: row.org_id,
    projectId: row.project_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    actorKeyPrefix: row.actor_key_prefix,
    action: row.action,
    subject: row.subject,
    before: row.before,
    after: row.after,
    createdAt: row.created_at,
  };
}

export function toApiOrg(row: OrgRow, role: OrgRole, members?: ApiOrgMember[]): ApiOrg {
  const decision = billingDecisionForOrg(row);
  const org: ApiOrg = {
    id: row.id,
    name: row.name,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    role,
    restricted: !decision.access.dashboardWrites,
    billingMessage: decision.message,
  };
  if (members) org.members = members;
  return org;
}

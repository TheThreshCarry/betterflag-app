/**
 * Shared types for the ShipOS MCP server.
 *
 * The control-plane response shapes are documented at the endpoint level in
 * docs/CONTRACTS.md but not field-by-field, so the API-side interfaces below
 * are deliberately tolerant: optional fields plus snake_case fallbacks, read
 * through the accessor helpers in api.ts.
 */
import type { JsonValue, TargetingRule } from "@shipos/core";
import type { Observability } from "@shipos/observability";

/** Worker environment (bindings + vars from wrangler.jsonc). */
export interface Env {
  /** Control-plane origin, e.g. https://app.shipos.app (no trailing slash). */
  SHIPOS_API_URL: string;
  MCP_OBJECT: DurableObjectNamespace;
  // Observability — optional; degrades to console-only when unset. Tokens via
  // `wrangler secret put`, endpoints via wrangler `vars`.
  BETTER_STACK_SOURCE_TOKEN?: string;
  BETTER_STACK_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  SHIPOS_ENV?: string;
  SHIPOS_RELEASE?: string;
}

/**
 * Per-session props handed from the Worker fetch handler to the McpAgent via
 * `ctx.props`. Holds the caller's bearer key; never logged.
 */
export type SessionProps = { apiKey: string };

/** Everything a tool needs to talk to the control plane. */
export interface ApiCtx {
  baseUrl: string;
  apiKey: string;
  /** Best-effort telemetry; never carries or logs the bearer key. */
  obs?: Observability;
}

// ---------------------------------------------------------------------------
// Control-plane resource shapes (tolerant)
// ---------------------------------------------------------------------------

export interface ProjectEnvironment {
  id?: string;
  slug?: string;
  name?: string;
}

export interface Project {
  id: string;
  slug?: string;
  name?: string;
  environments?: ProjectEnvironment[];
}

export interface FlagConfig {
  environment?: string | { slug?: string; name?: string };
  env?: string;
  envSlug?: string;
  environment_slug?: string;
  enabled?: boolean;
  killed?: boolean;
  killedAt?: string | null;
  killed_at?: string | null;
  rolloutPct?: number;
  rollout_pct?: number;
  rules?: TargetingRule[];
  valueOn?: JsonValue;
  value_on?: JsonValue;
  valueOff?: JsonValue;
  value_off?: JsonValue;
  version?: number;
}

export interface Flag {
  id: string;
  key: string;
  name?: string | null;
  description?: string | null;
  kind?: string;
  defaultValue?: JsonValue;
  default_value?: JsonValue;
  archivedAt?: string | null;
  archived_at?: string | null;
  createdAt?: string;
  created_at?: string;
  configs?: FlagConfig[] | Record<string, FlagConfig>;
  versions?: unknown;
}

export interface AuditEntry {
  id?: string;
  createdAt?: string;
  created_at?: string;
  at?: string;
  ts?: string;
  actorType?: string;
  actor_type?: string;
  actorId?: string;
  actor_id?: string;
  actorEmail?: string;
  actor_email?: string;
  actorKeyPrefix?: string;
  actor_key_prefix?: string;
  action?: string;
  subject?: string;
  subjectType?: string;
  subject_type?: string;
  subjectKey?: string;
  subject_key?: string;
  flagKey?: string;
  flag_key?: string;
  environment?: string;
  env?: string;
  envSlug?: string;
}

export interface Approval {
  id: string;
  status?: string;
  action?: string;
  createdAt?: string;
  created_at?: string;
  resolvedAt?: string;
  resolved_at?: string;
  environment?: string;
  env?: string;
  flagKey?: string;
  flag_key?: string;
  message?: string;
  requestedBy?: string;
  requested_by?: string;
}

export interface StatsRow {
  hour?: string;
  day?: string;
  ts?: string;
  t?: string;
  date?: string;
  time?: string;
  bucket?: string;
  on?: number;
  onCount?: number;
  on_count?: number;
  off?: number;
  offCount?: number;
  off_count?: number;
  total?: number;
  totalCount?: number;
  total_count?: number;
}

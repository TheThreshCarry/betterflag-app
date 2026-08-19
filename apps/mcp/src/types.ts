/**
 * Shared types for the Betterflag MCP server.
 *
 * The control-plane response shapes are documented at the endpoint level in
 * docs/CONTRACTS.md but not field-by-field, so the API-side interfaces below
 * are deliberately tolerant: optional fields plus snake_case fallbacks, read
 * through the accessor helpers in api.ts.
 */
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { JsonValue, TargetingRule } from "@betterflag/core";
import type { Observability } from "@betterflag/observability";

/** Worker environment (bindings + vars from wrangler.jsonc). */
export interface Env {
  /** Control-plane origin, e.g. https://app.betterflag.app (no trailing slash). */
  BETTERFLAG_API_URL: string;
  /** Dashboard origin hosting the OAuth consent screen (no trailing slash). */
  BETTERFLAG_DASHBOARD_URL: string;
  MCP_OBJECT: DurableObjectNamespace;
  /** Token/grant/client storage for @cloudflare/workers-oauth-provider. */
  OAUTH_KV: KVNamespace;
  /**
   * Injected by OAuthProvider into handlers it wraps; absent on the legacy
   * direct-bearer path (we never call it there).
   */
  OAUTH_PROVIDER?: OAuthHelpers;
  /**
   * SECRET, shared with the dashboard; authenticates the server-to-server
   * consent endpoints (/internal/oauth/*). `wrangler secret put MCP_OAUTH_SHARED_SECRET`.
   */
  MCP_OAUTH_SHARED_SECRET?: string;
  // Observability, optional; degrades to console-only when unset. Tokens via
  // `wrangler secret put`, endpoints via wrangler `vars`.
  BETTER_STACK_SOURCE_TOKEN?: string;
  BETTER_STACK_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  BETTERFLAG_ENV?: string;
  /** Deploy-time git commit; appended to VERSION as the release. */
  BETTERFLAG_GIT_SHA?: string;
  /** Fully-formed release override (wins over VERSION + git sha) if set. */
  BETTERFLAG_RELEASE?: string;
}

/**
 * Per-session props handed to the McpAgent via `ctx.props`, set directly by
 * the Worker fetch handler on the legacy bearer path, or decrypted from the
 * OAuth grant by workers-oauth-provider. Holds the caller's Betterflag key
 * (for OAuth grants, the per-connection bf_agt_ key minted at consent);
 * never logged.
 */
export type SessionProps = {
  apiKey: string;
  /** Present on OAuth-grant sessions only. */
  orgId?: string;
  keyPrefix?: string;
  via?: "bearer" | "oauth";
};

/** Everything a tool needs to talk to the control plane. */
export interface ApiCtx {
  baseUrl: string;
  apiKey: string;
  /** Best-effort telemetry; never carries or logs the bearer key. */
  obs?: Observability;
  waitUntil?: (promise: Promise<unknown>) => void;
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

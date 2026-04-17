/**
 * Cloudflare Worker Bindings
 */
export type Bindings = {
  /** KV namespace for storing feature flags and configs */
  SHIPOS_KV: KVNamespace;
  /** R2 bucket for media assets */
  MEDIA_ASSETS: R2Bucket;
  /** Static assets binding */
  ASSETS: Fetcher;
  /** Polar access token for usage event ingestion */
  POLAR_ACCESS_TOKEN: string;
  /** Polar API host (no path), e.g. https://api.polar.sh or https://sandbox-api.polar.sh */
  POLAR_API_BASE?: string;
  /** Shared secret for internal service-to-service calls (e.g. KV sync from Next.js) */
  SERVICE_SECRET: string;
  /** ClickHouse connection URL — DEPRECATED, removed in Phase 4. */
  CLICKHOUSE_URL?: string;
  /** ClickHouse username — DEPRECATED, removed in Phase 4. */
  CLICKHOUSE_USER?: string;
  /** ClickHouse password — DEPRECATED, removed in Phase 4. */
  CLICKHOUSE_PASSWORD?: string;
  /** ClickHouse database — DEPRECATED, removed in Phase 4. */
  CLICKHOUSE_DATABASE?: string;
  /** Tinybird ingest host, e.g. https://api.tinybird.co */
  TINYBIRD_HOST?: string;
  /** Tinybird ingest token (write to events + flag_evaluations) */
  TINYBIRD_INGEST_TOKEN?: string;
  /** Next.js app origin (for legacy proxy fallback only). */
  NEXT_APP_URL?: string;
};

/**
 * API Key data stored in KV for validation
 */
export type ApiKeyData = {
  /** Organization ID the API key belongs to */
  organizationId: string;
  /** User ID who created the API key */
  userId: string;
  /** Whether the API key is enabled */
  enabled: boolean;
  /** Expiration timestamp (ISO string) or null if no expiration */
  expiresAt: string | null;
  /** Optional permissions array */
  permissions?: string[];
  rateLimitEnabled?: boolean;
  rateLimitTimeWindow?: number;
  rateLimitMax?: number;
};

/**
 * Custom context variables added by middleware
 */
export type Variables = {
  /** Project API key extracted from x-shipos-key header */
  apiKey: string;
  /** Environment extracted from x-shipos-env header (defaults to 'production') */
  environment: string;
  /** Organization ID extracted from API key validation */
  organizationId: string;
  /** Full KV / DB metadata for this key (rate limits, permissions) */
  apiKeyData: ApiKeyData;
};

/**
 * Hono app environment type
 */
export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

/**
 * KV Key builders for consistent key formatting.
 *
 * Two schemes in flight during the Supabase cutover:
 *   - Legacy v1 scheme: `v1::org_{orgId}::{env}::*` (single-env)
 *   - Tenant scheme:    `tenant_{orgId}_*`         (multi-env payload)
 *
 * Readers try both and prefer the tenant scheme when present.
 */
export const KVKeys = {
  /** Preferred: v1::apikey_h::{sha256Hex} */
  apiKeyHashed: (keyHash: string): string => `v1::apikey_h::${keyHash}`,
  /** Legacy: v1::apikey::{rawApiKey} */
  apiKeyLegacy: (rawApiKey: string): string => `v1::apikey::${rawApiKey}`,

  /**
   * Build the flags key (legacy, per-env)
   * Format: v1::org_{orgId}::{env}::flags
   */
  flags: (orgId: string, env: string): string =>
    `v1::org_${orgId}::${env}::flags`,

  /**
   * Build the tenant-scheme flags key (plan R2)
   * Format: tenant_{orgId}_flags — value is `{ [env]: { [key]: bool } }`
   */
  flagsTenant: (orgId: string): string => `tenant_${orgId}_flags`,

  /**
   * Build the config key (legacy, per-env)
   * Format: v1::org_{orgId}::{env}::config::{slug}
   */
  config: (orgId: string, env: string, slug: string): string =>
    `v1::org_${orgId}::${env}::config::${slug}`,

  /**
   * Build the tenant-scheme config key (plan R2)
   * Format: tenant_{orgId}_config_{slug}
   */
  configTenant: (orgId: string, slug: string): string =>
    `tenant_${orgId}_config_${slug}`,

  /**
   * Build the customer key (organization-scoped)
   * Format: tenant_{orgId}_customer_{externalId}
   */
  customer: (orgId: string, externalId: string): string =>
    `tenant_${orgId}_customer_${externalId}`,

  /**
   * CMS entry key. Format: tenant_{orgId}_cms_{contentTypeSlug}_{entrySlug}
   */
  cmsEntry: (orgId: string, ctSlug: string, entrySlug: string): string =>
    `tenant_${orgId}_cms_${ctSlug}_${entrySlug}`,

  /**
   * CMS content-type index. Format: tenant_{orgId}_cms_{contentTypeSlug}_index
   */
  cmsIndex: (orgId: string, ctSlug: string): string =>
    `tenant_${orgId}_cms_${ctSlug}_index`,

  /**
   * Entitlements. Format: tenant_{orgId}_entitlements
   */
  entitlements: (orgId: string): string => `tenant_${orgId}_entitlements`,
};

/**
 * Standard API error response
 */
export type ApiError = {
  error: string;
  code?: string;
};

/**
 * Feature flags response type
 */
export type FlagsResponse = Record<string, boolean>;

/**
 * Config response type (varies by slug)
 */
export type ConfigResponse = Record<string, unknown>;

/**
 * Cloudflare Worker Bindings
 */
export type Bindings = {
  /** KV namespace for storing feature flags and configs */
  SHIPOS_KV: KVNamespace;
  /** R2 bucket for profile pictures */
  PROFILE_PICTURES: R2Bucket;
  /** R2 bucket for media assets */
  MEDIA_ASSETS: R2Bucket;
  /** Static assets binding */
  ASSETS: Fetcher;
  /** Polar access token for usage event ingestion */
  POLAR_ACCESS_TOKEN: string;
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
};

/**
 * Hono app environment type
 */
export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

/**
 * KV Key builders for consistent key formatting
 */
export const KVKeys = {
  /**
   * Build the API key lookup key
   * Format: v1::apikey::{apiKey}
   */
  apiKey: (apiKey: string): string => `v1::apikey::${apiKey}`,

  /**
   * Build the flags key (organization-scoped)
   * Format: v1::org_{orgId}::{env}::flags
   */
  flags: (orgId: string, env: string): string =>
    `v1::org_${orgId}::${env}::flags`,

  /**
   * Build the config key (organization-scoped)
   * Format: v1::org_{orgId}::{env}::config::{slug}
   */
  config: (orgId: string, env: string, slug: string): string =>
    `v1::org_${orgId}::${env}::config::${slug}`,

  /**
   * Build the customer key (organization-scoped)
   * Format: v1::org_{orgId}::customer::{externalId}
   */
  customer: (orgId: string, externalId: string): string =>
    `v1::org_${orgId}::customer::${externalId}`,
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

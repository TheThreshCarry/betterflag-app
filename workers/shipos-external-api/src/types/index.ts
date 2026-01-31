/**
 * Cloudflare Worker Bindings
 */
export type Bindings = {
  /** KV namespace for storing feature flags and configs */
  SHIPOS_KV: KVNamespace;
  /** R2 bucket for profile pictures */
  PROFILE_PICTURES: R2Bucket;
  /** Static assets binding */
  ASSETS: Fetcher;
};

/**
 * Custom context variables added by middleware
 */
export type Variables = {
  /** Project API key extracted from x-shipos-key header */
  apiKey: string;
  /** Environment extracted from x-shipos-env header (defaults to 'production') */
  environment: string;
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
   * Build the flags key
   * Format: v1::project_{apiKey}::{env}::flags
   */
  flags: (apiKey: string, env: string): string =>
    `v1::project_${apiKey}::${env}::flags`,

  /**
   * Build the config key
   * Format: v1::project_{apiKey}::{env}::config::{slug}
   */
  config: (apiKey: string, env: string, slug: string): string =>
    `v1::project_${apiKey}::${env}::config::${slug}`,
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

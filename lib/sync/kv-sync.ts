/**
 * KV Sync Utility
 *
 * Syncs data from PostgreSQL to Cloudflare KV via the Worker's
 * internal service routes (protected by SERVICE_SECRET).
 * This is called from server actions after CRUD operations.
 */

import { createLogger } from "@/lib/logger"
import { hashApiKey } from "@/lib/api-key-hash"

const log = createLogger("kv-sync")
const WORKER_API_URL = process.env.WORKER_API_URL
const SERVICE_SECRET = process.env.SERVICE_SECRET

/**
 * KV Key builders (must match the Worker's KVKeys)
 */
export const KVKeys = {
  /** Preferred: lookup by SHA-256 hex hash of the raw API key (no secret material in the key). */
  apiKeyHashed: (keyHash: string): string => `v1::apikey_h::${keyHash}`,
  /** Legacy: raw key in KV key (migrated lazily on the worker). */
  apiKeyLegacy: (rawApiKey: string): string => `v1::apikey::${rawApiKey}`,
  flags: (orgId: string, env: string): string =>
    `v1::org_${orgId}::${env}::flags`,
  config: (orgId: string, env: string, slug: string): string =>
    `v1::org_${orgId}::${env}::config::${slug}`,
}

/**
 * API Key data structure for KV storage
 */
export type ApiKeyData = {
  organizationId: string
  userId: string
  enabled: boolean
  expiresAt: string | null
  permissions?: string[]
  rateLimitEnabled?: boolean
  rateLimitTimeWindow?: number
  rateLimitMax?: number
}

/**
 * Write a single key-value pair to KV via the Worker
 */
async function writeToKV(key: string, value: unknown): Promise<boolean> {
  if (!WORKER_API_URL || !SERVICE_SECRET) {
    log.warn("missing WORKER_API_URL or SERVICE_SECRET — KV write skipped")
    return false
  }

  const url = `${WORKER_API_URL}/internal/kv/${encodeURIComponent(key)}`

  try {
    log.debug({ key }, "KV write attempt")
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "x-service-secret": SERVICE_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    })

    if (!response.ok) {
      const body = await response.text()
      log.error({ key, status: response.status, body }, "KV write failed")
      return false
    }

    log.info({ key }, "KV write succeeded")
    return true
  } catch (error) {
    log.error({ key, err: error }, "KV write error")
    return false
  }
}

/**
 * Delete a key from KV via the Worker
 */
async function deleteFromKV(key: string): Promise<boolean> {
  if (!WORKER_API_URL || !SERVICE_SECRET) {
    log.warn("missing WORKER_API_URL or SERVICE_SECRET — KV delete skipped")
    return false
  }

  const url = `${WORKER_API_URL}/internal/kv/${encodeURIComponent(key)}`

  try {
    log.debug({ key }, "KV delete attempt")
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "x-service-secret": SERVICE_SECRET,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      log.error({ key, status: response.status, body }, "KV delete failed")
      return false
    }

    log.info({ key }, "KV delete succeeded")
    return true
  } catch (error) {
    log.error({ key, err: error }, "KV delete error")
    return false
  }
}

/**
 * Sync an API key to KV (hashed key only; never stores raw key in KV key path).
 */
export async function syncApiKey(
  rawApiKey: string,
  data: ApiKeyData
): Promise<boolean> {
  const keyHash = await hashApiKey(rawApiKey)
  const key = KVKeys.apiKeyHashed(keyHash)
  return writeToKV(key, data)
}

/**
 * Sync API key metadata to KV when only the DB hash is available (e.g. toggle enabled).
 */
export async function syncApiKeyByHash(
  keyHash: string,
  data: ApiKeyData
): Promise<boolean> {
  const key = KVKeys.apiKeyHashed(keyHash)
  return writeToKV(key, data)
}

/**
 * Delete an API key from KV using the **hash** stored in the database (`apikey.key`).
 */
export async function deleteApiKeyFromKV(keyHash: string): Promise<boolean> {
  const key = KVKeys.apiKeyHashed(keyHash)
  return deleteFromKV(key)
}

/**
 * Sync all feature flags for an organization and environment
 */
export async function syncFlags(
  organizationId: string,
  environment: string,
  flags: Record<string, boolean>
): Promise<boolean> {
  const key = KVKeys.flags(organizationId, environment)
  return writeToKV(key, flags)
}

/**
 * Delete flags for an organization and environment from KV
 */
export async function deleteFlagsFromKV(
  organizationId: string,
  environment: string
): Promise<boolean> {
  const key = KVKeys.flags(organizationId, environment)
  return deleteFromKV(key)
}

/**
 * Sync a global config to KV
 */
export async function syncConfig(
  organizationId: string,
  environment: string,
  slug: string,
  data: Record<string, unknown>
): Promise<boolean> {
  const key = KVKeys.config(organizationId, environment, slug)
  return writeToKV(key, data)
}

/**
 * Delete a config from KV
 */
export async function deleteConfigFromKV(
  organizationId: string,
  environment: string,
  slug: string
): Promise<boolean> {
  const key = KVKeys.config(organizationId, environment, slug)
  return deleteFromKV(key)
}

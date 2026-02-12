/**
 * KV Sync Utility
 *
 * Syncs data from PostgreSQL to Cloudflare KV via the Worker's
 * internal service routes (protected by SERVICE_SECRET).
 * This is called from server actions after CRUD operations.
 */

const WORKER_API_URL = process.env.WORKER_API_URL;
const SERVICE_SECRET = process.env.SERVICE_SECRET;

/**
 * KV Key builders (must match the Worker's KVKeys)
 */
export const KVKeys = {
  apiKey: (apiKey: string): string => `v1::apikey::${apiKey}`,
  flags: (orgId: string, env: string): string =>
    `v1::org_${orgId}::${env}::flags`,
  config: (orgId: string, env: string, slug: string): string =>
    `v1::org_${orgId}::${env}::config::${slug}`,
};

/**
 * API Key data structure for KV storage
 */
export type ApiKeyData = {
  organizationId: string;
  userId: string;
  enabled: boolean;
  expiresAt: string | null;
  permissions?: string[];
};

/**
 * Write a single key-value pair to KV via the Worker
 */
async function writeToKV(key: string, value: unknown): Promise<boolean> {
  if (!WORKER_API_URL || !SERVICE_SECRET) {
    console.error("Missing WORKER_API_URL or SERVICE_SECRET configuration");
    return false;
  }

  const url = `${WORKER_API_URL}/internal/kv/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "x-service-secret": SERVICE_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to write to KV: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error writing to KV:", error);
    return false;
  }
}

/**
 * Delete a key from KV via the Worker
 */
async function deleteFromKV(key: string): Promise<boolean> {
  if (!WORKER_API_URL || !SERVICE_SECRET) {
    console.error("Missing WORKER_API_URL or SERVICE_SECRET configuration");
    return false;
  }

  const url = `${WORKER_API_URL}/internal/kv/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "x-service-secret": SERVICE_SECRET,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to delete from KV: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting from KV:", error);
    return false;
  }
}

/**
 * Sync an API key to KV
 */
export async function syncApiKey(
  apiKey: string,
  data: ApiKeyData
): Promise<boolean> {
  const key = KVKeys.apiKey(apiKey);
  return writeToKV(key, data);
}

/**
 * Delete an API key from KV
 */
export async function deleteApiKeyFromKV(apiKey: string): Promise<boolean> {
  const key = KVKeys.apiKey(apiKey);
  return deleteFromKV(key);
}

/**
 * Sync all feature flags for an organization and environment
 */
export async function syncFlags(
  organizationId: string,
  environment: string,
  flags: Record<string, boolean>
): Promise<boolean> {
  const key = KVKeys.flags(organizationId, environment);
  return writeToKV(key, flags);
}

/**
 * Delete flags for an organization and environment from KV
 */
export async function deleteFlagsFromKV(
  organizationId: string,
  environment: string
): Promise<boolean> {
  const key = KVKeys.flags(organizationId, environment);
  return deleteFromKV(key);
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
  const key = KVKeys.config(organizationId, environment, slug);
  return writeToKV(key, data);
}

/**
 * Delete a config from KV
 */
export async function deleteConfigFromKV(
  organizationId: string,
  environment: string,
  slug: string
): Promise<boolean> {
  const key = KVKeys.config(organizationId, environment, slug);
  return deleteFromKV(key);
}

/**
 * KV Sync Utility
 *
 * Syncs data from PostgreSQL to Cloudflare KV via the REST API.
 * This is called from server actions after CRUD operations.
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

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
 * Write a single key-value pair to Cloudflare KV
 */
async function writeToKV(key: string, value: unknown): Promise<boolean> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
    console.error("Missing Cloudflare KV configuration");
    return false;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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
 * Delete a key from Cloudflare KV
 */
async function deleteFromKV(key: string): Promise<boolean> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
    console.error("Missing Cloudflare KV configuration");
    return false;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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

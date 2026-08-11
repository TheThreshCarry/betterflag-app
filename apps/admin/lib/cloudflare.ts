/**
 * Cloudflare KV cleanup used when deleting an org: the Postgres cascade
 * removes rows, but edge snapshots (cfg:{projectId}:{envSlug}) and SDK key
 * entries (key:{prefix}) live in KV and must be deleted explicitly or the
 * edge would keep serving a ghost config. No-ops with a console.warn in dev
 * when the CF_* env vars are unset, mirroring the dashboard app.
 */

import { sdkKeyKvKey, snapshotKvKey } from "@betterflag/core";

import { optionalEnv } from "./env";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

async function kvDelete(key: string, context: string): Promise<void> {
  const accountId = optionalEnv("CF_ACCOUNT_ID");
  const apiToken = optionalEnv("CF_API_TOKEN");
  const namespaceId = optionalEnv("CF_KV_NAMESPACE_ID");
  if (!accountId || !apiToken || !namespaceId) {
    console.warn(`[cloudflare] ${context} skipped, CF_* env vars unset`);
    return;
  }

  const url = `${CF_API_BASE}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    // 404 means the key was never written (dev orgs); that is fine.
    if (!res.ok && res.status !== 404) {
      console.error(`[cloudflare] ${context} failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[cloudflare] ${context} failed:`, err);
  }
}

export async function kvDeleteSnapshot(projectId: string, envSlug: string): Promise<void> {
  await kvDelete(snapshotKvKey(projectId, envSlug), "kv snapshot delete");
}

export async function kvDeleteSdkKey(prefix: string): Promise<void> {
  await kvDelete(sdkKeyKvKey(prefix), "kv sdk key delete");
}

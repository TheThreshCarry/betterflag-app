/**
 * Cloudflare REST helpers used by the control plane:
 *  - enqueueConfigSync  → shipos-config-sync queue (fire-and-forget)
 *  - kvPutSnapshot      → cfg:{projectId}:{envSlug} (kill-switch fast path)
 *  - kvPutSdkKey / kvDeleteSdkKey → key:{prefix}
 *
 * Every helper no-ops with a console.warn in dev when the CF_* env vars are
 * unset, so the dashboard works end-to-end without a Cloudflare account.
 */

import { sdkKeyKvKey, snapshotKvKey, type SdkKeyKvEntry } from "@shipos/core";

import { optionalEnv } from "./env";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export interface ConfigSyncMessage {
  type: "sync";
  projectId: string;
  environmentId: string;
  envSlug: string;
  orgId: string;
}

interface CfAuth {
  accountId: string;
  apiToken: string;
}

function cfAuth(context: string): CfAuth | null {
  const accountId = optionalEnv("CF_ACCOUNT_ID");
  const apiToken = optionalEnv("CF_API_TOKEN");
  if (!accountId || !apiToken) {
    console.warn(`[cloudflare] ${context} skipped — CF_ACCOUNT_ID / CF_API_TOKEN unset`);
    return null;
  }
  return { accountId, apiToken };
}

/**
 * Enqueue a config-sync message for the ingest worker. Fire-and-forget:
 * failures are logged, never thrown — the KV fast path and the nightly
 * reconciliation cover redelivery.
 */
export function enqueueConfigSync(message: Omit<ConfigSyncMessage, "type">): void {
  const auth = cfAuth("config-sync enqueue");
  const queueId = optionalEnv("CF_QUEUE_CONFIG_SYNC_ID");
  if (!auth || !queueId) {
    if (auth && !queueId) {
      console.warn("[cloudflare] config-sync enqueue skipped — CF_QUEUE_CONFIG_SYNC_ID unset");
    }
    return;
  }

  const payload: ConfigSyncMessage = { type: "sync", ...message };
  void fetch(`${CF_API_BASE}/accounts/${auth.accountId}/queues/${queueId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: JSON.stringify(payload) }),
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error(
          `[cloudflare] config-sync enqueue failed: ${res.status} ${await res.text()}`,
        );
      }
    })
    .catch((err: unknown) => {
      console.error("[cloudflare] config-sync enqueue failed:", err);
    });
}

async function kvWrite(key: string, body: string | null, context: string): Promise<void> {
  const auth = cfAuth(context);
  const namespaceId = optionalEnv("CF_KV_NAMESPACE_ID");
  if (!auth || !namespaceId) {
    if (auth && !namespaceId) {
      console.warn(`[cloudflare] ${context} skipped — CF_KV_NAMESPACE_ID unset`);
    }
    return;
  }

  const url = `${CF_API_BASE}/accounts/${auth.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      method: body === null ? "DELETE" : "PUT",
      headers: {
        Authorization: `Bearer ${auth.apiToken}`,
        ...(body === null ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === null ? {} : { body }),
    });
    if (!res.ok) {
      console.error(`[cloudflare] ${context} failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[cloudflare] ${context} failed:`, err);
  }
}

/** Write a rebuilt snapshot to KV at cfg:{projectId}:{envSlug}. */
export async function kvPutSnapshot(
  projectId: string,
  envSlug: string,
  snapshotJson: string,
): Promise<void> {
  await kvWrite(snapshotKvKey(projectId, envSlug), snapshotJson, "kv snapshot put");
}

/** Write an SDK key entry to KV at key:{prefix} (created or revoked). */
export async function kvPutSdkKey(prefix: string, entry: SdkKeyKvEntry): Promise<void> {
  await kvWrite(sdkKeyKvKey(prefix), JSON.stringify(entry), "kv sdk key put");
}

/** Delete an SDK key entry from KV. */
export async function kvDeleteSdkKey(prefix: string): Promise<void> {
  await kvWrite(sdkKeyKvKey(prefix), null, "kv sdk key delete");
}

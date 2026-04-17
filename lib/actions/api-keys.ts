"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  syncApiKey,
  syncApiKeyByHash,
  deleteApiKeyFromKV,
  type ApiKeyData,
} from "@/lib/sync/kv-sync"
import { getSessionData } from "@/lib/actions/utils"
import { getSupabaseSessionOptional } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { createLogger } from "@/lib/logger"
import { captureProductEvent, ProductEvent } from "@/lib/analytics/product-events"
import { hashApiKey } from "@/lib/api-key-hash"

export type ApiKey = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean | null
  createdAt: Date
  expiresAt: Date | null
  lastRequest: Date | null
}

/**
 * Get all API keys for the current active organization (RLS gated).
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  const { organizationId } = await getSessionData()
  if (!organizationId) return []

  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.apikeys", session) : createLogger("actions.apikeys")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, prefix, start, enabled, created_at, expires_at, last_used_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (error) {
    log.error({ err: error, organizationId }, "failed to fetch api keys")
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? null,
    start: row.start ?? null,
    prefix: row.prefix ?? null,
    enabled: row.enabled ?? true,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    lastRequest: row.last_used_at ? new Date(row.last_used_at) : null,
  }))
}

/**
 * Create a new API key for the user's active organization.
 * Returns the full key once (never stored plaintext).
 */
export async function createApiKey(
  name: string,
): Promise<{ id: string; key: string } | null> {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.apikeys", session) : createLogger("actions.apikeys")
  const { userId, organizationId } = await getSessionData()
  if (!userId) throw new Error("Not authenticated")
  if (!organizationId) throw new Error("No active organization")

  const keyBytes = new Uint8Array(32)
  crypto.getRandomValues(keyBytes)
  const fullKey = `sk_${Buffer.from(keyBytes).toString("base64url")}`

  const prefix = "sk"
  const start = fullKey.slice(3, 11)
  const keyHash = await hashApiKey(fullKey)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      name,
      prefix,
      start,
      key_hash: keyHash,
      user_id: userId,
      organization_id: organizationId,
      enabled: true,
    })
    .select("id")
    .single()

  if (error || !data) {
    log.error({ err: error, userId }, "failed to insert api key")
    throw new Error("Failed to create API key")
  }

  const apiKeyData: ApiKeyData = {
    organizationId,
    userId,
    enabled: true,
    expiresAt: null,
    rateLimitEnabled: true,
    rateLimitTimeWindow: 86400000,
    rateLimitMax: 10,
  }
  await syncApiKey(fullKey, apiKeyData)

  log.info({ apiKeyId: data.id, userId }, "API key created")
  captureProductEvent(ProductEvent.API_KEY_CREATED, session, {
    api_key_id: data.id,
  })
  revalidatePath("/dashboard/settings/api-keys")
  return { id: data.id, key: fullKey }
}

/**
 * Delete an API key (RLS restricts to admins/owners of the active org).
 */
export async function deleteApiKey(id: string): Promise<void> {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.apikeys", session) : createLogger("actions.apikeys")
  const { userId } = await getSessionData()
  if (!userId) throw new Error("Not authenticated")

  const supabase = await createClient()
  const { data: row, error: fetchErr } = await supabase
    .from("api_keys")
    .select("key_hash")
    .eq("id", id)
    .maybeSingle()

  if (fetchErr || !row) throw new Error("API key not found")

  const { error: delErr } = await supabase.from("api_keys").delete().eq("id", id)
  if (delErr) throw new Error("Failed to delete API key")

  await deleteApiKeyFromKV(row.key_hash)
  log.info({ apiKeyId: id, userId }, "API key deleted")
  captureProductEvent(ProductEvent.API_KEY_DELETED, session, { api_key_id: id })
  revalidatePath("/dashboard/settings/api-keys")
}

/**
 * Toggle API key enabled flag.
 */
export async function toggleApiKey(id: string, enabled: boolean): Promise<void> {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.apikeys", session) : createLogger("actions.apikeys")
  const { userId, organizationId } = await getSessionData()
  if (!userId) throw new Error("Not authenticated")
  if (!organizationId) throw new Error("No active organization")

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("api_keys")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("key_hash, enabled, expires_at, rate_limit_enabled, rate_limit_time_window, rate_limit_max, user_id")
    .maybeSingle()

  if (error || !updated) throw new Error("Failed to update API key")

  const data: ApiKeyData = {
    organizationId,
    userId: updated.user_id ?? userId,
    enabled: updated.enabled ?? true,
    expiresAt: updated.expires_at ?? null,
    rateLimitEnabled: updated.rate_limit_enabled ?? true,
    rateLimitTimeWindow: updated.rate_limit_time_window ?? 86400000,
    rateLimitMax: updated.rate_limit_max ?? 10,
  }
  await syncApiKeyByHash(updated.key_hash, data)

  log.info({ apiKeyId: id, enabled }, "API key toggled")
  captureProductEvent(ProductEvent.API_KEY_TOGGLED, session, {
    api_key_id: id,
    enabled,
  })
  revalidatePath("/dashboard/settings/api-keys")
}

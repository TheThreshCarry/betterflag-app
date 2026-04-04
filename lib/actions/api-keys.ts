"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { apikey } from "@/lib/auth/auth-schema"
import {
  syncApiKey,
  syncApiKeyByHash,
  deleteApiKeyFromKV,
  type ApiKeyData,
} from "@/lib/sync/kv-sync"
import { getSessionData } from "@/lib/actions/utils"
import { createLogger } from "@/lib/logger"
import { hashApiKey } from "@/lib/api-key-hash"

const log = createLogger("actions.apikeys")

function parsePermissionsJson(
  raw: string | null | undefined
): string[] | undefined {
  if (raw == null || raw === "") return undefined
  try {
    const v = JSON.parse(raw) as unknown
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === "string")
    }
  } catch {
    /* ignore */
  }
  return undefined
}

function apiKeyDataFromRow(
  row: typeof apikey.$inferSelect
): ApiKeyData | null {
  if (!row.organizationId) return null
  return {
    organizationId: row.organizationId,
    userId: row.userId,
    enabled: row.enabled ?? true,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    permissions: parsePermissionsJson(row.permissions ?? undefined),
    rateLimitEnabled: row.rateLimitEnabled ?? undefined,
    rateLimitTimeWindow: row.rateLimitTimeWindow ?? undefined,
    rateLimitMax: row.rateLimitMax ?? undefined,
  }
}

/**
 * API Key type for the UI
 */
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
 * Get all API keys for the current user
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  const { userId } = await getSessionData()

  if (!userId) {
    return []
  }

  const keys = await db.query.apikey.findMany({
    where: eq(apikey.userId, userId),
    orderBy: (keys, { desc }) => [desc(keys.createdAt)],
  })

  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    start: key.start,
    prefix: key.prefix,
    enabled: key.enabled,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt,
    lastRequest: key.lastRequest,
  }))
}

/**
 * Create a new API key
 * Returns the full key (only shown once)
 */
export async function createApiKey(name: string): Promise<{ id: string; key: string } | null> {
  const { userId, organizationId } = await getSessionData()

  if (!userId) {
    throw new Error("Not authenticated")
  }

  const keyBytes = new Uint8Array(32)
  crypto.getRandomValues(keyBytes)
  const fullKey = `sk_${Buffer.from(keyBytes).toString("base64url")}`

  const prefix = "sk"
  const start = fullKey.slice(3, 11)

  const keyHash = await hashApiKey(fullKey)

  const id = crypto.randomUUID()
  const now = new Date()

  await db.insert(apikey).values({
    id,
    name,
    key: keyHash,
    prefix,
    start,
    userId,
    organizationId: organizationId ?? null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  })

  if (organizationId) {
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
  }

  log.info({ apiKeyId: id, userId }, "API key created")
  revalidatePath("/dashboard/settings/api-keys")

  return { id, key: fullKey }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(id: string): Promise<void> {
  const { userId } = await getSessionData()

  if (!userId) {
    throw new Error("Not authenticated")
  }

  const key = await db.query.apikey.findFirst({
    where: and(eq(apikey.id, id), eq(apikey.userId, userId)),
  })

  if (!key) {
    throw new Error("API key not found")
  }

  await db.delete(apikey).where(eq(apikey.id, id))
  log.info({ apiKeyId: id, userId }, "API key deleted")

  await deleteApiKeyFromKV(key.key)

  revalidatePath("/dashboard/settings/api-keys")
}

/**
 * Toggle API key enabled status
 */
export async function toggleApiKey(id: string, enabled: boolean): Promise<void> {
  const { userId } = await getSessionData()

  if (!userId) {
    throw new Error("Not authenticated")
  }

  const key = await db.query.apikey.findFirst({
    where: and(eq(apikey.id, id), eq(apikey.userId, userId)),
  })

  if (!key) {
    throw new Error("API key not found")
  }

  await db
    .update(apikey)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(apikey.id, id))
  log.info({ apiKeyId: id, enabled }, "API key toggled")

  const updated = await db.query.apikey.findFirst({
    where: eq(apikey.id, id),
  })
  if (updated) {
    const data = apiKeyDataFromRow(updated)
    if (data) {
      await syncApiKeyByHash(updated.key, data)
    }
  }

  revalidatePath("/dashboard/settings/api-keys")
}

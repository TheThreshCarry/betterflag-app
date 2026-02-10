"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { apikey } from "@/lib/auth/auth-schema"
import { syncApiKey, deleteApiKeyFromKV, type ApiKeyData } from "@/lib/sync/kv-sync"
import { getSessionData } from "@/lib/actions/utils"

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
  
  // Generate a secure API key
  const keyBytes = new Uint8Array(32)
  crypto.getRandomValues(keyBytes)
  const fullKey = `sk_${Buffer.from(keyBytes).toString("base64url")}`
  
  // Create prefix and start for display
  const prefix = "sk"
  const start = fullKey.slice(3, 11) // First 8 chars after prefix
  
  // Hash the key for database storage
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
    enabled: true,
    createdAt: now,
    updatedAt: now,
  })
  
  // Sync to KV for edge validation using the full key
  // KV uses the full key as the lookup key, not the hash
  if (organizationId) {
    const apiKeyData: ApiKeyData = {
      organizationId,
      userId,
      enabled: true,
      expiresAt: null,
    }
    await syncApiKey(fullKey, apiKeyData)
  }
  
  revalidatePath("/dashboard/settings/api-keys")
  
  // Return the full key (only shown once)
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
  
  // Get the key first to verify ownership and get the key for KV deletion
  const key = await db.query.apikey.findFirst({
    where: and(eq(apikey.id, id), eq(apikey.userId, userId)),
  })
  
  if (!key) {
    throw new Error("API key not found")
  }
  
  // Delete from database
  await db.delete(apikey).where(eq(apikey.id, id))
  
  // Note: We can't delete from KV because we don't have the original key
  // The key in the database is hashed. This is a limitation - revoked keys
  // will remain in KV until they're overwritten or expire.
  // For immediate revocation, we'd need to store the key differently.
  
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
  
  // Verify ownership
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
  
  // Note: Same limitation as delete - we can't update KV without the original key
  
  revalidatePath("/dashboard/settings/api-keys")
}

/**
 * Hash an API key for storage
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

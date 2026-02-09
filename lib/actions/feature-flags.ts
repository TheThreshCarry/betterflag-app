"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { featureFlags, type NewFeatureFlag } from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { syncFlags, KVKeys } from "@/lib/sync/kv-sync"

async function getOrganizationId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session?.session.activeOrganizationId || null
}

/**
 * Sync all flags for an organization to KV
 * Groups flags by environment and syncs each group
 */
async function syncFlagsToKV(organizationId: string | null) {
  if (!organizationId) return

  // Get all flags for the organization
  const allFlags = await db.query.featureFlags.findMany({
    where: eq(featureFlags.organizationId, organizationId),
  })

  // Group flags by environment
  const flagsByEnv = allFlags.reduce((acc, flag) => {
    const env = flag.environment || "production"
    if (!acc[env]) acc[env] = {}
    acc[env][flag.key] = flag.enabled
    return acc
  }, {} as Record<string, Record<string, boolean>>)

  // Sync each environment's flags to KV
  await Promise.all(
    Object.entries(flagsByEnv).map(([env, flags]) =>
      syncFlags(organizationId, env, flags)
    )
  )
}

export async function getFeatureFlags(environment?: string) {
  const organizationId = await getOrganizationId()
  
  if (environment) {
    return db.query.featureFlags.findMany({
      where: and(
        eq(featureFlags.organizationId, organizationId),
        eq(featureFlags.environment, environment)
      ),
      orderBy: (flags, { desc }) => [desc(flags.createdAt)],
    })
  }
  
  return db.query.featureFlags.findMany({
    where: eq(featureFlags.organizationId, organizationId),
    orderBy: (flags, { desc }) => [desc(flags.createdAt)],
  })
}

export async function getFeatureFlag(id: string) {
  return db.query.featureFlags.findFirst({
    where: eq(featureFlags.id, id),
  })
}

export async function createFeatureFlag(data: Omit<NewFeatureFlag, "id" | "createdAt" | "updatedAt" | "organizationId">) {
  const organizationId = await getOrganizationId()
  
  const [flag] = await db
    .insert(featureFlags)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  // Sync flags to KV
  await syncFlagsToKV(organizationId)

  revalidatePath("/dashboard/flags")
  return flag
}

export async function updateFeatureFlag(
  id: string,
  data: Partial<Omit<NewFeatureFlag, "id" | "createdAt" | "organizationId">>
) {
  const [flag] = await db
    .update(featureFlags)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(featureFlags.id, id))
    .returning()

  // Sync flags to KV
  if (flag?.organizationId) {
    await syncFlagsToKV(flag.organizationId)
  }

  revalidatePath("/dashboard/flags")
  return flag
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  return updateFeatureFlag(id, { enabled })
}

export async function deleteFeatureFlag(id: string) {
  // Get the flag first to know the organization
  const flag = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.id, id),
  })
  
  await db.delete(featureFlags).where(eq(featureFlags.id, id))
  
  // Sync flags to KV
  if (flag?.organizationId) {
    await syncFlagsToKV(flag.organizationId)
  }
  
  revalidatePath("/dashboard/flags")
}

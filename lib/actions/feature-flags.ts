"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { featureFlags, type NewFeatureFlag } from "@/lib/db/schema"
import { syncFlags } from "@/lib/sync/kv-sync"
import { getOrganizationId } from "@/lib/actions/utils"
import { createLogger } from "@/lib/logger"

const log = createLogger("actions.flags")

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
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  return db.query.featureFlags.findFirst({
    where: and(eq(featureFlags.id, id), eq(featureFlags.organizationId, organizationId)),
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

  await syncFlagsToKV(organizationId)
  log.info({ id: flag.id, key: data.key, orgId: organizationId }, "feature flag created")

  revalidatePath("/dashboard/flags")
  return flag
}

export async function updateFeatureFlag(
  id: string,
  data: Partial<Omit<NewFeatureFlag, "id" | "createdAt" | "organizationId">>
) {
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const [flag] = await db
    .update(featureFlags)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(featureFlags.id, id), eq(featureFlags.organizationId, organizationId)))
    .returning()

  if (flag?.organizationId) {
    await syncFlagsToKV(flag.organizationId)
  }
  log.info({ id, key: flag?.key, enabled: flag?.enabled }, "feature flag updated")

  revalidatePath("/dashboard/flags")
  revalidatePath(`/dashboard/flags/${id}`)
  return flag
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  return updateFeatureFlag(id, { enabled })
}

export async function deleteFeatureFlag(id: string) {
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const flag = await db.query.featureFlags.findFirst({
    where: and(eq(featureFlags.id, id), eq(featureFlags.organizationId, organizationId)),
  })
  if (!flag) throw new Error("Feature flag not found")

  await db.delete(featureFlags).where(and(eq(featureFlags.id, id), eq(featureFlags.organizationId, organizationId)))
  
  if (flag?.organizationId) {
    await syncFlagsToKV(flag.organizationId)
  }
  log.info({ id, key: flag?.key }, "feature flag deleted")
  
  revalidatePath("/dashboard/flags")
}

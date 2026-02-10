"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { globalConfigs, type NewGlobalConfig, type GlobalConfig } from "@/lib/db/schema"
import { syncConfig, deleteConfigFromKV } from "@/lib/sync/kv-sync"
import { getOrganizationId } from "@/lib/actions/utils"

/**
 * Sync a single config to KV
 */
async function syncConfigToKV(config: GlobalConfig) {
  if (!config.organizationId || !config.slug) return
  
  const environment = config.environment || "production"
  const data = (config.data as Record<string, unknown>) || {}
  
  await syncConfig(config.organizationId, environment, config.slug, data)
}

export async function getGlobalConfigs(environment?: string) {
  const organizationId = await getOrganizationId()
  
  if (environment) {
    return db.query.globalConfigs.findMany({
      where: and(
        eq(globalConfigs.organizationId, organizationId),
        eq(globalConfigs.environment, environment)
      ),
      orderBy: (configs, { desc }) => [desc(configs.createdAt)],
    })
  }
  
  return db.query.globalConfigs.findMany({
    where: eq(globalConfigs.organizationId, organizationId),
    orderBy: (configs, { desc }) => [desc(configs.createdAt)],
  })
}

export async function getGlobalConfig(id: string) {
  return db.query.globalConfigs.findFirst({
    where: eq(globalConfigs.id, id),
  })
}

export async function createGlobalConfig(
  data: Omit<NewGlobalConfig, "id" | "createdAt" | "updatedAt" | "organizationId">
) {
  const organizationId = await getOrganizationId()
  
  const [config] = await db
    .insert(globalConfigs)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  // Sync config to KV
  await syncConfigToKV(config)

  revalidatePath("/dashboard/configs")
  return config
}

export async function updateGlobalConfig(
  id: string,
  data: Partial<Omit<NewGlobalConfig, "id" | "createdAt" | "organizationId">>
) {
  const [config] = await db
    .update(globalConfigs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(globalConfigs.id, id))
    .returning()

  // Sync config to KV
  await syncConfigToKV(config)

  revalidatePath("/dashboard/configs")
  return config
}

export async function deleteGlobalConfig(id: string) {
  // Get the config first to know the organization and slug
  const config = await db.query.globalConfigs.findFirst({
    where: eq(globalConfigs.id, id),
  })
  
  await db.delete(globalConfigs).where(eq(globalConfigs.id, id))
  
  // Delete config from KV
  if (config?.organizationId && config?.slug) {
    const environment = config.environment || "production"
    await deleteConfigFromKV(config.organizationId, environment, config.slug)
  }
  
  revalidatePath("/dashboard/configs")
}

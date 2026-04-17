"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { globalConfigs, type NewGlobalConfig, type GlobalConfig } from "@/lib/db/schema"
import { syncConfig, deleteConfigFromKV } from "@/lib/sync/kv-sync"
import { getOrganizationId } from "@/lib/actions/utils"
import { getSupabaseSessionOptional } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { createLogger } from "@/lib/logger"
import { captureProductEvent, ProductEvent } from "@/lib/analytics/product-events"

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
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  return db.query.globalConfigs.findFirst({
    where: and(eq(globalConfigs.id, id), eq(globalConfigs.organizationId, organizationId)),
  })
}

export async function createGlobalConfig(
  data: Omit<NewGlobalConfig, "id" | "createdAt" | "updatedAt" | "organizationId">
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.configs", session) : createLogger("actions.configs")
  const organizationId = await getOrganizationId()
  
  const [config] = await db
    .insert(globalConfigs)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  await syncConfigToKV(config)
  log.info({ id: config.id, slug: config.slug }, "global config created")
  captureProductEvent(ProductEvent.GLOBAL_CONFIG_CREATED, session, {
    config_id: config.id,
    slug: config.slug,
  })

  revalidatePath("/dashboard/configs")
  return config
}

export async function updateGlobalConfig(
  id: string,
  data: Partial<Omit<NewGlobalConfig, "id" | "createdAt" | "organizationId">>
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.configs", session) : createLogger("actions.configs")
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const [config] = await db
    .update(globalConfigs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(globalConfigs.id, id), eq(globalConfigs.organizationId, organizationId)))
    .returning()

  await syncConfigToKV(config)
  log.info({ id, slug: config.slug }, "global config updated")
  captureProductEvent(ProductEvent.GLOBAL_CONFIG_UPDATED, session, {
    config_id: id,
    slug: config.slug,
  })

  revalidatePath("/dashboard/configs")
  return config
}

export async function deleteGlobalConfig(id: string) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.configs", session) : createLogger("actions.configs")
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const config = await db.query.globalConfigs.findFirst({
    where: and(eq(globalConfigs.id, id), eq(globalConfigs.organizationId, organizationId)),
  })
  if (!config) throw new Error("Config not found")

  await db.delete(globalConfigs).where(and(eq(globalConfigs.id, id), eq(globalConfigs.organizationId, organizationId)))
  
  if (config?.organizationId && config?.slug) {
    const environment = config.environment || "production"
    await deleteConfigFromKV(config.organizationId, environment, config.slug)
  }
  log.info({ id, slug: config?.slug }, "global config deleted")
  captureProductEvent(ProductEvent.GLOBAL_CONFIG_DELETED, session, {
    config_id: id,
    slug: config?.slug,
  })
  
  revalidatePath("/dashboard/configs")
}

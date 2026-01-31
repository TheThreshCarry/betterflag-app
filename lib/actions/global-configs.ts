"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { globalConfigs, type NewGlobalConfig } from "@/lib/db/schema"
import { auth } from "@/lib/auth"

async function getOrganizationId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session?.session.activeOrganizationId || null
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

  revalidatePath("/dashboard/settings/config")
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

  revalidatePath("/dashboard/settings/config")
  return config
}

export async function deleteGlobalConfig(id: string) {
  await db.delete(globalConfigs).where(eq(globalConfigs.id, id))
  revalidatePath("/dashboard/settings/config")
}

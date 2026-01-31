"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { featureFlags, type NewFeatureFlag } from "@/lib/db/schema"
import { auth } from "@/lib/auth"

async function getOrganizationId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session?.session.activeOrganizationId || null
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

  revalidatePath("/dashboard/flags")
  return flag
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  return updateFeatureFlag(id, { enabled })
}

export async function deleteFeatureFlag(id: string) {
  await db.delete(featureFlags).where(eq(featureFlags.id, id))
  revalidatePath("/dashboard/flags")
}

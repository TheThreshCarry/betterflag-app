"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { cmsMedia, type NewCmsMedia } from "@/lib/db/schema"
import { getSessionData } from "@/lib/actions/utils"

export async function getCmsMedia() {
  const { organizationId } = await getSessionData()

  return db.query.cmsMedia.findMany({
    where: organizationId
      ? eq(cmsMedia.organizationId, organizationId)
      : isNull(cmsMedia.organizationId),
    orderBy: [desc(cmsMedia.createdAt)],
  })
}

export async function getCmsMediaById(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  return db.query.cmsMedia.findFirst({
    where: and(eq(cmsMedia.id, id), eq(cmsMedia.organizationId, organizationId)),
  })
}

export async function getCmsMediaBySlug(slug: string) {
  const { organizationId } = await getSessionData()

  return db.query.cmsMedia.findFirst({
    where: and(
      organizationId
        ? eq(cmsMedia.organizationId, organizationId)
        : isNull(cmsMedia.organizationId),
      eq(cmsMedia.slug, slug)
    ),
  })
}

export async function createCmsMedia(
  data: Omit<NewCmsMedia, "id" | "createdAt" | "organizationId">
) {
  const { organizationId } = await getSessionData()

  const [entry] = await db
    .insert(cmsMedia)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  revalidatePath("/dashboard/cms/media")
  return entry
}

export async function updateCmsMedia(
  id: string,
  data: Partial<Omit<NewCmsMedia, "id" | "createdAt" | "organizationId">>
) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const [entry] = await db
    .update(cmsMedia)
    .set(data)
    .where(and(eq(cmsMedia.id, id), eq(cmsMedia.organizationId, organizationId)))
    .returning()

  revalidatePath("/dashboard/cms/media")
  return entry
}

export async function deleteCmsMedia(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const existing = await db.query.cmsMedia.findFirst({
    where: and(eq(cmsMedia.id, id), eq(cmsMedia.organizationId, organizationId)),
  })
  if (!existing) throw new Error("CMS media not found")
  await db.delete(cmsMedia).where(and(eq(cmsMedia.id, id), eq(cmsMedia.organizationId, organizationId)))

  revalidatePath("/dashboard/cms/media")
}

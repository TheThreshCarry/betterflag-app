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
  return db.query.cmsMedia.findFirst({
    where: eq(cmsMedia.id, id),
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
  const [entry] = await db
    .update(cmsMedia)
    .set(data)
    .where(eq(cmsMedia.id, id))
    .returning()

  revalidatePath("/dashboard/cms/media")
  return entry
}

export async function deleteCmsMedia(id: string) {
  await db.delete(cmsMedia).where(eq(cmsMedia.id, id))

  revalidatePath("/dashboard/cms/media")
}

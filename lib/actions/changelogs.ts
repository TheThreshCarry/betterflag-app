"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, isNull, isNotNull, ne } from "drizzle-orm"
import db from "@/lib/db"
import {
  changelogs,
  changelogLabelAssignments,
  type NewChangelog,
} from "@/lib/db/schema"
import { getSessionData } from "@/lib/actions/utils"
import { getSupabaseSessionOptional } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { createLogger } from "@/lib/logger"
import { captureProductEvent, ProductEvent } from "@/lib/analytics/product-events"

export async function getChangelogs() {
  const { organizationId } = await getSessionData()

  return db.query.changelogs.findMany({
    where: organizationId
      ? eq(changelogs.organizationId, organizationId)
      : isNull(changelogs.organizationId),
    orderBy: [desc(changelogs.createdAt)],
  })
}

export async function getChangelog(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  return db.query.changelogs.findFirst({
    where: and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)),
  })
}

export async function getChangelogLabelAssignments(changelogId: string) {
  return db.query.changelogLabelAssignments.findMany({
    where: eq(changelogLabelAssignments.changelogId, changelogId),
  })
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

export async function createChangelog(
  data: Omit<NewChangelog, "id" | "createdAt" | "updatedAt" | "organizationId" | "authorId" | "slug">
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.changelogs", session) : createLogger("actions.changelogs")
  const { organizationId, userId } = await getSessionData()

  const slug = slugify(data.title)

  const [entry] = await db
    .insert(changelogs)
    .values({
      ...data,
      slug,
      organizationId,
      authorId: userId,
    })
    .returning()

  log.info({ id: entry.id, slug }, "changelog created")
  captureProductEvent(ProductEvent.CHANGELOG_CREATED, session, {
    changelog_id: entry.id,
    slug,
  })
  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function updateChangelog(
  id: string,
  data: Partial<Omit<NewChangelog, "id" | "createdAt" | "organizationId" | "authorId">>
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.changelogs", session) : createLogger("actions.changelogs")
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  }
  if (data.title) {
    updateData.slug = slugify(data.title)
  }

  const [entry] = await db
    .update(changelogs)
    .set(updateData)
    .where(and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)))
    .returning()

  log.info({ id }, "changelog updated")
  captureProductEvent(ProductEvent.CHANGELOG_UPDATED, session, {
    changelog_id: id,
  })
  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function publishChangelog(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const [entry] = await db
    .update(changelogs)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function unpublishChangelog(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const [entry] = await db
    .update(changelogs)
    .set({
      status: "draft",
      publishedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function deployChangelog(id: string) {
  const { organizationId } = await getSessionData()

  // First, undeploy any currently deployed changelog in this organization
  const condition = organizationId
    ? and(
        eq(changelogs.organizationId, organizationId),
        isNotNull(changelogs.deployedAt),
        ne(changelogs.id, id)
      )
    : and(
        isNull(changelogs.organizationId),
        isNotNull(changelogs.deployedAt),
        ne(changelogs.id, id)
      )

  await db
    .update(changelogs)
    .set({ deployedAt: null, updatedAt: new Date() })
    .where(condition)

  const [entry] = await db
    .update(changelogs)
    .set({
      deployedAt: new Date(),
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function undeployChangelog(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const [entry] = await db
    .update(changelogs)
    .set({
      deployedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function deleteChangelog(id: string) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.changelogs", session) : createLogger("actions.changelogs")
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const existing = await db.query.changelogs.findFirst({
    where: and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)),
  })
  if (!existing) throw new Error("Changelog not found")

  await db
    .delete(changelogLabelAssignments)
    .where(eq(changelogLabelAssignments.changelogId, id))

  await db.delete(changelogs).where(and(eq(changelogs.id, id), eq(changelogs.organizationId, organizationId)))
  log.info({ id }, "changelog deleted")
  captureProductEvent(ProductEvent.CHANGELOG_DELETED, session, { changelog_id: id })

  revalidatePath("/dashboard/changelogs")
}

export async function assignLabelsToChangelog(
  changelogId: string,
  labelIds: string[]
) {
  // Remove existing assignments
  await db
    .delete(changelogLabelAssignments)
    .where(eq(changelogLabelAssignments.changelogId, changelogId))

  // Insert new assignments
  if (labelIds.length > 0) {
    await db.insert(changelogLabelAssignments).values(
      labelIds.map((labelId) => ({
        changelogId,
        labelId,
      }))
    )
  }

  revalidatePath("/dashboard/changelogs")
}

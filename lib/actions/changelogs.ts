"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { eq, and, desc, isNull, isNotNull, ne } from "drizzle-orm"
import db from "@/lib/db"
import {
  changelogs,
  changelogLabelAssignments,
  type NewChangelog,
} from "@/lib/db/schema"
import { auth } from "@/lib/auth"

async function getSessionData() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return {
    organizationId: session?.session.activeOrganizationId || null,
    userId: session?.user.id || null,
  }
}

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
  return db.query.changelogs.findFirst({
    where: eq(changelogs.id, id),
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

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function updateChangelog(
  id: string,
  data: Partial<Omit<NewChangelog, "id" | "createdAt" | "organizationId" | "authorId">>
) {
  // Re-generate slug if title is being updated
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
    .where(eq(changelogs.id, id))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function publishChangelog(id: string) {
  const [entry] = await db
    .update(changelogs)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changelogs.id, id))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function unpublishChangelog(id: string) {
  const [entry] = await db
    .update(changelogs)
    .set({
      status: "draft",
      publishedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(changelogs.id, id))
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

  // Then deploy the target changelog (also publish it if not already)
  const [entry] = await db
    .update(changelogs)
    .set({
      deployedAt: new Date(),
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changelogs.id, id))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function undeployChangelog(id: string) {
  const [entry] = await db
    .update(changelogs)
    .set({
      deployedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(changelogs.id, id))
    .returning()

  revalidatePath("/dashboard/changelogs")
  return entry
}

export async function deleteChangelog(id: string) {
  // Also delete label assignments
  await db
    .delete(changelogLabelAssignments)
    .where(eq(changelogLabelAssignments.changelogId, id))

  await db.delete(changelogs).where(eq(changelogs.id, id))

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

"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { eq, desc, isNull } from "drizzle-orm"
import db from "@/lib/db"
import {
  changelogLabels,
  changelogLabelAssignments,
  type NewChangelogLabel,
} from "@/lib/db/schema"
import { auth } from "@/lib/auth"

async function getOrganizationId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session?.session.activeOrganizationId || null
}

export async function getChangelogLabels() {
  const organizationId = await getOrganizationId()

  return db.query.changelogLabels.findMany({
    where: organizationId
      ? eq(changelogLabels.organizationId, organizationId)
      : isNull(changelogLabels.organizationId),
    orderBy: [desc(changelogLabels.createdAt)],
  })
}

export async function getChangelogLabel(id: string) {
  return db.query.changelogLabels.findFirst({
    where: eq(changelogLabels.id, id),
  })
}

export async function createChangelogLabel(
  data: Omit<NewChangelogLabel, "id" | "createdAt" | "organizationId">
) {
  const organizationId = await getOrganizationId()

  const [label] = await db
    .insert(changelogLabels)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  revalidatePath("/dashboard/changelogs/labels")
  return label
}

export async function updateChangelogLabel(
  id: string,
  data: Partial<Omit<NewChangelogLabel, "id" | "createdAt" | "organizationId">>
) {
  const [label] = await db
    .update(changelogLabels)
    .set(data)
    .where(eq(changelogLabels.id, id))
    .returning()

  revalidatePath("/dashboard/changelogs/labels")
  return label
}

export async function deleteChangelogLabel(id: string) {
  // Remove all assignments using this label
  await db
    .delete(changelogLabelAssignments)
    .where(eq(changelogLabelAssignments.labelId, id))

  await db.delete(changelogLabels).where(eq(changelogLabels.id, id))

  revalidatePath("/dashboard/changelogs/labels")
}

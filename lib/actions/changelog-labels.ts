"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, isNull } from "drizzle-orm"
import db from "@/lib/db"
import {
  changelogLabels,
  changelogLabelAssignments,
  type NewChangelogLabel,
} from "@/lib/db/schema"
import { getOrganizationId } from "@/lib/actions/utils"

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
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  return db.query.changelogLabels.findFirst({
    where: and(eq(changelogLabels.id, id), eq(changelogLabels.organizationId, organizationId)),
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
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const [label] = await db
    .update(changelogLabels)
    .set(data)
    .where(and(eq(changelogLabels.id, id), eq(changelogLabels.organizationId, organizationId)))
    .returning()

  revalidatePath("/dashboard/changelogs/labels")
  return label
}

export async function deleteChangelogLabel(id: string) {
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const existing = await db.query.changelogLabels.findFirst({
    where: and(eq(changelogLabels.id, id), eq(changelogLabels.organizationId, organizationId)),
  })
  if (!existing) throw new Error("Label not found")

  await db
    .delete(changelogLabelAssignments)
    .where(eq(changelogLabelAssignments.labelId, id))

  await db.delete(changelogLabels).where(and(eq(changelogLabels.id, id), eq(changelogLabels.organizationId, organizationId)))

  revalidatePath("/dashboard/changelogs/labels")
}

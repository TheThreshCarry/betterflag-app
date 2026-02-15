"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import db from "@/lib/db"
import { entryRelations } from "@/lib/db/schema"
import { getSessionData } from "@/lib/actions/utils"

export async function getEntryRelations(entryId: string) {
  return db.query.entryRelations.findMany({
    where: eq(entryRelations.entryId, entryId),
  })
}

export async function getEntryRelationsByType(entryId: string, type: string) {
  return db.query.entryRelations.findMany({
    where: and(
      eq(entryRelations.entryId, entryId),
      eq(entryRelations.type, type)
    ),
  })
}

export async function addRelation(
  entryId: string,
  type: string,
  value: string
) {
  const { organizationId } = await getSessionData()

  const [relation] = await db
    .insert(entryRelations)
    .values({
      organizationId,
      entryId,
      type,
      value,
    })
    .returning()

  revalidatePath("/dashboard/cms")
  return relation
}

export async function removeRelation(id: string) {
  await db.delete(entryRelations).where(eq(entryRelations.id, id))

  revalidatePath("/dashboard/cms")
}

export async function setRelations(
  entryId: string,
  type: string,
  values: string[]
) {
  const { organizationId } = await getSessionData()

  // Remove existing relations of this type for this entry
  await db
    .delete(entryRelations)
    .where(
      and(
        eq(entryRelations.entryId, entryId),
        eq(entryRelations.type, type)
      )
    )

  // Insert new relations
  if (values.length > 0) {
    await db.insert(entryRelations).values(
      values.map((value) => ({
        organizationId,
        entryId,
        type,
        value,
      }))
    )
  }

  revalidatePath("/dashboard/cms")
}

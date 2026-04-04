"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, isNull, inArray } from "drizzle-orm"
import db from "@/lib/db"
import {
  entries,
  contentTypes,
  entryRelations,
  type NewEntry,
} from "@/lib/db/schema"
import { getSessionData } from "@/lib/actions/utils"
import { parseSchemaFields } from "@/lib/cms/schema-utils"
import { validateEntryData, coerceFieldValues } from "@/lib/cms/schema-validation"
import { createLogger } from "@/lib/logger"

const log = createLogger("actions.cms")

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

async function validateEntryAgainstSchema(
  contentTypeId: string,
  data: Record<string, unknown>
): Promise<void> {
  const contentType = await db.query.contentTypes.findFirst({
    where: eq(contentTypes.id, contentTypeId),
  })

  if (!contentType) {
    throw new Error("Content type not found")
  }

  const schemaFields = parseSchemaFields(contentType.schema)
  if (schemaFields.length === 0) return

  // Coerce values to proper types before validating
  const coerced = coerceFieldValues(schemaFields, data)
  const result = validateEntryData(schemaFields, coerced)

  if (!result.success) {
    const missingRequired = schemaFields
      .filter(f => f.required && (coerced[f.name] === null || coerced[f.name] === undefined || coerced[f.name] === ""))
      .map(f => f.label || f.name)
    
    if (missingRequired.length > 0) {
      throw new Error(`Cannot publish: Missing required fields — ${missingRequired.join(", ")}`)
    }
    
    const errorMessages = Object.entries(result.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ")
    throw new Error(`Validation failed — ${errorMessages}`)
  }
}

export async function getEntries(contentTypeId?: string) {
  const { organizationId } = await getSessionData()

  const conditions = [
    organizationId
      ? eq(entries.organizationId, organizationId)
      : isNull(entries.organizationId),
  ]

  if (contentTypeId) {
    conditions.push(eq(entries.contentTypeId, contentTypeId))
  }

  return db.query.entries.findMany({
    where: and(...conditions),
    orderBy: [desc(entries.createdAt)],
    with: {
      contentType: true,
    },
  })
}

export async function getEntry(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  return db.query.entries.findFirst({
    where: and(eq(entries.id, id), eq(entries.organizationId, organizationId)),
    with: {
      contentType: true,
      entryRelations: true,
    },
  })
}

export async function getEntriesByContentType(contentTypeId: string) {
  const { organizationId } = await getSessionData()

  return db.query.entries.findMany({
    where: and(
      organizationId
        ? eq(entries.organizationId, organizationId)
        : isNull(entries.organizationId),
      eq(entries.contentTypeId, contentTypeId)
    ),
    orderBy: [desc(entries.createdAt)],
  })
}

export async function createEntry(
  data: Omit<NewEntry, "id" | "createdAt" | "updatedAt" | "organizationId"> & { title?: string }
) {
  const { organizationId } = await getSessionData()

  // Prioritize the title argument over data.title (schema field)
  const entryTitle = data.title || (
    data.data && typeof data.data === "object" 
      ? (data.data as Record<string, unknown>).title 
      : undefined
  )
  
  if (!entryTitle || (typeof entryTitle === "string" && !entryTitle.trim())) {
    throw new Error("Entry title is required")
  }

  const slug = data.slug || slugify(String(entryTitle) || "untitled")

  const [entry] = await db
    .insert(entries)
    .values({
      contentTypeId: data.contentTypeId,
      slug,
      status: data.status,
      data: data.data,
      organizationId,
    })
    .returning()

  log.info({ id: entry.id, slug, contentTypeId: data.contentTypeId }, "entry created")
  revalidatePath("/dashboard/cms")
  return entry
}

export async function updateEntry(
  id: string,
  data: Partial<Omit<NewEntry, "id" | "createdAt" | "organizationId">> & { title?: string }
) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")

  const entryTitle = data.title !== undefined ? data.title : (
    data.data && typeof data.data === "object"
      ? (data.data as Record<string, unknown>).title as string | undefined
      : undefined
  )
  
  if (entryTitle !== undefined && (!entryTitle || (typeof entryTitle === "string" && !entryTitle.trim()))) {
    throw new Error("Entry title is required")
  }

  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  }

  delete updateData.title

  if (entryTitle && typeof entryTitle === "string") {
    updateData.slug = slugify(entryTitle)
  }

  const [entry] = await db
    .update(entries)
    .set(updateData)
    .where(and(eq(entries.id, id), eq(entries.organizationId, organizationId)))
    .returning()

  revalidatePath("/dashboard/cms")
  return entry
}

async function assertEntriesInOrganization(
  ids: string[],
  organizationId: string
): Promise<void> {
  if (ids.length === 0) return
  const found = await db.query.entries.findMany({
    where: and(
      eq(entries.organizationId, organizationId),
      inArray(entries.id, ids)
    ),
    columns: { id: true },
  })
  if (found.length !== ids.length) {
    throw new Error("Some entries were not found or you do not have access")
  }
}

export async function deleteEntry(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  await assertEntriesInOrganization([id], organizationId)
  await db.delete(entries).where(eq(entries.id, id))
  log.info({ id }, "entry deleted")

  revalidatePath("/dashboard/cms")
}

export async function bulkDeleteEntries(ids: string[]) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  if (ids.length === 0) return
  await assertEntriesInOrganization(ids, organizationId)
  await db.delete(entries).where(inArray(entries.id, ids))
  log.info({ count: ids.length }, "entries bulk deleted")
  revalidatePath("/dashboard/cms")
}

export async function bulkPublishEntries(ids: string[]) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  if (ids.length === 0) return
  await assertEntriesInOrganization(ids, organizationId)
  for (const id of ids) {
    await publishEntry(id)
  }
}

export async function bulkUnpublishEntries(ids: string[]) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  if (ids.length === 0) return
  await assertEntriesInOrganization(ids, organizationId)
  await db
    .update(entries)
    .set({ status: "draft", updatedAt: new Date() })
    .where(inArray(entries.id, ids))
  revalidatePath("/dashboard/cms")
}

export async function publishEntry(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")

  const entry = await db.query.entries.findFirst({
    where: eq(entries.id, id),
    with: { contentType: true },
  })

  if (!entry || entry.organizationId !== organizationId) {
    throw new Error("Entry not found")
  }

  // Full schema validation before publishing
  if (entry.data && typeof entry.data === "object") {
    await validateEntryAgainstSchema(
      entry.contentTypeId,
      entry.data as Record<string, unknown>
    )
  }

  const [updated] = await db
    .update(entries)
    .set({
      status: "published",
      updatedAt: new Date(),
    })
    .where(eq(entries.id, id))
    .returning()

  revalidatePath("/dashboard/cms")
  return updated
}

export async function unpublishEntry(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  await assertEntriesInOrganization([id], organizationId)

  const [entry] = await db
    .update(entries)
    .set({
      status: "draft",
      updatedAt: new Date(),
    })
    .where(eq(entries.id, id))
    .returning()

  revalidatePath("/dashboard/cms")
  return entry
}

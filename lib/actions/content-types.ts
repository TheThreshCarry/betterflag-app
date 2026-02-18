"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, isNull } from "drizzle-orm"
import db from "@/lib/db"
import {
  contentTypes,
  schemaMigrations,
  type NewContentType,
} from "@/lib/db/schema"
import { getSessionData } from "@/lib/actions/utils"
import type { SchemaField, SchemaChange } from "@/lib/cms/types"
import { parseSchemaFields, toSchemaJson, isLegacySchema, migrateLegacySchema } from "@/lib/cms/schema-utils"
import { diffSchemas, getMaxSeverity } from "@/lib/cms/schema-diff"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

export async function getContentTypes() {
  const { organizationId } = await getSessionData()

  return db.query.contentTypes.findMany({
    where: organizationId
      ? eq(contentTypes.organizationId, organizationId)
      : isNull(contentTypes.organizationId),
    orderBy: [desc(contentTypes.createdAt)],
  })
}

export async function getContentType(id: string) {
  return db.query.contentTypes.findFirst({
    where: eq(contentTypes.id, id),
  })
}

export async function getContentTypeBySlug(slug: string) {
  const { organizationId } = await getSessionData()

  return db.query.contentTypes.findFirst({
    where: and(
      organizationId
        ? eq(contentTypes.organizationId, organizationId)
        : isNull(contentTypes.organizationId),
      eq(contentTypes.slug, slug)
    ),
  })
}

export async function createContentType(
  data: Omit<NewContentType, "id" | "createdAt" | "updatedAt" | "organizationId" | "slug">
) {
  const { organizationId } = await getSessionData()

  const slug = slugify(data.name)

  const [entry] = await db
    .insert(contentTypes)
    .values({
      ...data,
      slug,
      organizationId,
    })
    .returning()

  revalidatePath("/dashboard/cms")
  return entry
}

export async function updateContentType(
  id: string,
  data: Partial<Omit<NewContentType, "id" | "createdAt" | "organizationId">>
) {
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  }
  if (data.name) {
    updateData.slug = slugify(data.name)
  }

  const [entry] = await db
    .update(contentTypes)
    .set(updateData)
    .where(eq(contentTypes.id, id))
    .returning()

  revalidatePath("/dashboard/cms")
  return entry
}

export async function deleteContentType(id: string) {
  await db.delete(contentTypes).where(eq(contentTypes.id, id))

  revalidatePath("/dashboard/cms")
}

export async function setContentTypeStatus(
  id: string,
  status: "draft" | "active" | "deprecated"
) {
  const [entry] = await db
    .update(contentTypes)
    .set({ status, updatedAt: new Date() })
    .where(eq(contentTypes.id, id))
    .returning()

  revalidatePath("/dashboard/cms")
  return entry
}

// ─── Schema builder actions ──────────────────────────────────────────

/**
 * Validate schema changes without saving. Returns the list of changes
 * and their severity so the UI can show the appropriate dialog.
 */
export async function validateSchemaChanges(
  contentTypeId: string,
  newFields: SchemaField[]
): Promise<{
  changes: SchemaChange[]
  maxSeverity: "safe" | "risky" | "destructive"
}> {
  const ct = await db.query.contentTypes.findFirst({
    where: eq(contentTypes.id, contentTypeId),
  })
  if (!ct) throw new Error("Content type not found")

  const oldFields = parseSchemaFields(ct.schema)
  const changes = diffSchemas(oldFields, newFields)
  const maxSev = getMaxSeverity(changes)

  return { changes, maxSeverity: maxSev }
}

/**
 * Save a new schema version for a content type.
 * The caller is responsible for confirming risky/destructive changes
 * via the UI before calling this with force=true.
 */
export async function updateContentTypeSchema(
  contentTypeId: string,
  newFields: SchemaField[],
  options?: {
    force?: boolean
  }
): Promise<{
  success: boolean
  contentType?: Awaited<ReturnType<typeof getContentType>>
  requiresConfirmation?: boolean
  changes?: SchemaChange[]
  maxSeverity?: "safe" | "risky" | "destructive"
}> {
  const ct = await db.query.contentTypes.findFirst({
    where: eq(contentTypes.id, contentTypeId),
  })
  if (!ct) throw new Error("Content type not found")

  const oldFields = parseSchemaFields(ct.schema)
  const changes = diffSchemas(oldFields, newFields)
  const maxSev = getMaxSeverity(changes)

  // If not forced and there are non-safe changes, return for UI confirmation
  if (!options?.force && (maxSev === "risky" || maxSev === "destructive")) {
    return {
      success: false,
      requiresConfirmation: true,
      changes,
      maxSeverity: maxSev,
    }
  }

  const newVersion = (ct.version ?? 1) + 1
  const newSchema = toSchemaJson(newFields)

  // Save schema + increment version
  const [updated] = await db
    .update(contentTypes)
    .set({
      schema: newSchema,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(eq(contentTypes.id, contentTypeId))
    .returning()

  // Record migration
  if (changes.length > 0) {
    await db.insert(schemaMigrations).values({
      organizationId: ct.organizationId,
      contentTypeId: ct.id,
      fromVersion: ct.version ?? 1,
      toVersion: newVersion,
      changes: changes as unknown as Record<string, unknown>,
      status: "done",
    })
  }

  revalidatePath("/dashboard/cms")

  return {
    success: true,
    contentType: updated,
  }
}

/**
 * Upgrade a content type from legacy schema format to v2.
 */
export async function upgradeLegacySchema(
  contentTypeId: string
): Promise<{ success: boolean }> {
  const ct = await db.query.contentTypes.findFirst({
    where: eq(contentTypes.id, contentTypeId),
  })
  if (!ct) throw new Error("Content type not found")

  if (!isLegacySchema(ct.schema)) {
    return { success: true } // Already v2
  }

  const newSchema = migrateLegacySchema(ct.schema)
  const newVersion = (ct.version ?? 1) + 1

  await db
    .update(contentTypes)
    .set({
      schema: newSchema,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(eq(contentTypes.id, contentTypeId))

  await db.insert(schemaMigrations).values({
    organizationId: ct.organizationId,
    contentTypeId: ct.id,
    fromVersion: ct.version ?? 1,
    toVersion: newVersion,
    changes: [{ action: "legacyUpgrade", severity: "safe" }] as unknown as Record<string, unknown>,
    status: "done",
  })

  revalidatePath("/dashboard/cms")
  return { success: true }
}

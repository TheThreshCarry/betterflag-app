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
import {
  getCachedContentTypes,
  getCachedContentType,
  getCachedContentTypeBySlug,
  invalidateContentTypeCache,
} from "@/lib/cache/content-types"
import { getSupabaseSessionOptional } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { createLogger } from "@/lib/logger"
import { captureProductEvent, ProductEvent } from "@/lib/analytics/product-events"

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

  return getCachedContentTypes(organizationId, () =>
    db.query.contentTypes.findMany({
      where: organizationId
        ? eq(contentTypes.organizationId, organizationId)
        : isNull(contentTypes.organizationId),
      orderBy: [desc(contentTypes.createdAt)],
    })
  )
}

export async function getContentType(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  return getCachedContentType(id, () =>
    db.query.contentTypes.findFirst({
      where: and(eq(contentTypes.id, id), eq(contentTypes.organizationId, organizationId)),
    })
  )
}

export async function getContentTypeBySlug(slug: string) {
  const { organizationId } = await getSessionData()

  return getCachedContentTypeBySlug(organizationId, slug, () =>
    db.query.contentTypes.findFirst({
      where: and(
        organizationId
          ? eq(contentTypes.organizationId, organizationId)
          : isNull(contentTypes.organizationId),
        eq(contentTypes.slug, slug)
      ),
    })
  )
}

export async function createContentType(
  data: Omit<NewContentType, "id" | "createdAt" | "updatedAt" | "organizationId" | "slug">
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.cms", session) : createLogger("actions.cms")
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

  await invalidateContentTypeCache(organizationId)
  log.info({ id: entry.id, slug, orgId: organizationId }, "content type created")
  captureProductEvent(ProductEvent.CONTENT_TYPE_CREATED, session, {
    content_type_id: entry.id,
    slug,
  })
  revalidatePath("/dashboard/cms")
  return entry
}

export async function updateContentType(
  id: string,
  data: Partial<Omit<NewContentType, "id" | "createdAt" | "organizationId">>
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.cms", session) : createLogger("actions.cms")
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
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
    .where(and(eq(contentTypes.id, id), eq(contentTypes.organizationId, organizationId)))
    .returning()

  await invalidateContentTypeCache(entry.organizationId, id, entry.slug)
  log.info({ id, slug: entry.slug }, "content type updated")
  captureProductEvent(ProductEvent.CONTENT_TYPE_UPDATED, session, {
    content_type_id: id,
    slug: entry.slug,
  })
  revalidatePath("/dashboard/cms")
  return entry
}

export async function deleteContentType(id: string) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.cms", session) : createLogger("actions.cms")
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const ct = await db.query.contentTypes.findFirst({
    where: and(eq(contentTypes.id, id), eq(contentTypes.organizationId, organizationId)),
  })
  if (!ct) throw new Error("Content type not found")

  await db.delete(contentTypes).where(and(eq(contentTypes.id, id), eq(contentTypes.organizationId, organizationId)))

  if (ct) await invalidateContentTypeCache(ct.organizationId, id, ct.slug)
  log.info({ id, slug: ct?.slug }, "content type deleted")
  captureProductEvent(ProductEvent.CONTENT_TYPE_DELETED, session, {
    content_type_id: id,
    slug: ct?.slug,
  })
  revalidatePath("/dashboard/cms")
}

export async function setContentTypeStatus(
  id: string,
  status: "draft" | "active" | "deprecated"
) {
  const session = await getSupabaseSessionOptional()
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  const [entry] = await db
    .update(contentTypes)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(contentTypes.id, id), eq(contentTypes.organizationId, organizationId)))
    .returning()

  await invalidateContentTypeCache(entry.organizationId, id, entry.slug)
  captureProductEvent(ProductEvent.CONTENT_TYPE_STATUS_CHANGED, session, {
    content_type_id: id,
    status,
  })
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

  await invalidateContentTypeCache(ct.organizationId, contentTypeId, ct.slug)
  revalidatePath("/dashboard/cms")

  const session = await getSupabaseSessionOptional()
  captureProductEvent(ProductEvent.CONTENT_TYPE_SCHEMA_UPDATED, session, {
    content_type_id: contentTypeId,
    slug: ct.slug,
    from_version: ct.version ?? 1,
    to_version: newVersion,
    change_count: changes.length,
  })

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

  await invalidateContentTypeCache(ct.organizationId, contentTypeId, ct.slug)
  revalidatePath("/dashboard/cms")
  const session = await getSupabaseSessionOptional()
  captureProductEvent(ProductEvent.CONTENT_TYPE_SCHEMA_UPDATED, session, {
    content_type_id: contentTypeId,
    slug: ct.slug,
    legacy_upgrade: true,
  })
  return { success: true }
}

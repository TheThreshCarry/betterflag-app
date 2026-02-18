"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, isNull } from "drizzle-orm"
import db from "@/lib/db"
import {
  schemaMigrations,
  contentTypes,
  type NewSchemaMigration,
} from "@/lib/db/schema"
import { getSessionData } from "@/lib/actions/utils"
import { validateMigrationChanges, type MigrationChange } from "@/lib/cms/type-migration-rules"

export async function getSchemaMigrations(contentTypeId?: string) {
  const { organizationId } = await getSessionData()

  const conditions = [
    organizationId
      ? eq(schemaMigrations.organizationId, organizationId)
      : isNull(schemaMigrations.organizationId),
  ]

  if (contentTypeId) {
    conditions.push(eq(schemaMigrations.contentTypeId, contentTypeId))
  }

  return db.query.schemaMigrations.findMany({
    where: and(...conditions),
    orderBy: [desc(schemaMigrations.createdAt)],
  })
}

export async function createMigration(
  data: Omit<NewSchemaMigration, "id" | "createdAt" | "organizationId">
) {
  const { organizationId } = await getSessionData()

  const [entry] = await db
    .insert(schemaMigrations)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  revalidatePath("/dashboard/cms")
  return entry
}

export async function updateMigrationStatus(
  id: string,
  status: "pending" | "done" | "error"
) {
  const [entry] = await db
    .update(schemaMigrations)
    .set({ status })
    .where(eq(schemaMigrations.id, id))
    .returning()

  revalidatePath("/dashboard/cms")
  return entry
}

export async function runMigration(id: string) {
  // 1. Get the migration record
  const migration = await db.query.schemaMigrations.findFirst({
    where: eq(schemaMigrations.id, id),
  })

  if (!migration) {
    throw new Error("Migration not found")
  }

  if (migration.status === "done") {
    throw new Error("Migration already applied")
  }

  // 2. Get the content type
  const contentType = await db.query.contentTypes.findFirst({
    where: eq(contentTypes.id, migration.contentTypeId),
  })

  if (!contentType) {
    throw new Error("Content type not found")
  }

  // 3. Validate the migration changes
  const changes = migration.changes as MigrationChange[]
  const validation = validateMigrationChanges(changes)

  if (validation.destructive.length > 0) {
    // Mark as error — destructive changes must be explicitly confirmed
    await db
      .update(schemaMigrations)
      .set({ status: "error" })
      .where(eq(schemaMigrations.id, id))

    return {
      success: false,
      error: "Destructive changes detected",
      validation,
    }
  }

  if (validation.risky.length > 0) {
    // Mark as pending — risky changes require user confirmation
    return {
      success: false,
      error: "Risky changes require confirmation",
      validation,
    }
  }

  // 4. Apply the migration: update the content type schema + version
  try {
    const currentSchema = (contentType.schema as Record<string, unknown>) || {}
    const updatedSchema = applyChanges(currentSchema, changes)

    await db
      .update(contentTypes)
      .set({
        schema: updatedSchema,
        version: migration.toVersion,
        updatedAt: new Date(),
      })
      .where(eq(contentTypes.id, contentType.id))

    // 5. Mark migration as done
    await db
      .update(schemaMigrations)
      .set({ status: "done" })
      .where(eq(schemaMigrations.id, id))

    revalidatePath("/dashboard/cms")
    return { success: true, validation }
  } catch (error) {
    await db
      .update(schemaMigrations)
      .set({ status: "error" })
      .where(eq(schemaMigrations.id, id))

    throw error
  }
}

/**
 * Apply a set of migration changes to a content type schema.
 */
function applyChanges(
  schema: Record<string, unknown>,
  changes: MigrationChange[]
): Record<string, unknown> {
  const fields = { ...(schema.fields as Record<string, unknown> || {}) }

  for (const change of changes) {
    switch (change.action) {
      case "add":
        if (change.field && change.toType) {
          fields[change.field] = { type: change.toType, ...(change.config || {}) }
        }
        break
      case "remove":
        if (change.field) {
          delete fields[change.field]
        }
        break
      case "rename":
        if (change.field && change.newField) {
          fields[change.newField] = fields[change.field]
          delete fields[change.field]
        }
        break
      case "change_type":
        if (change.field && change.toType) {
          const existing = fields[change.field] as Record<string, unknown> || {}
          fields[change.field] = { ...existing, type: change.toType }
        }
        break
    }
  }

  return { ...schema, fields }
}

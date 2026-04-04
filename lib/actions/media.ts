"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, sql, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { mediaAssets, mediaFolders } from "@/lib/db/schema"
import { getSessionData } from "@/lib/actions/utils"
import { createLogger } from "@/lib/logger"
import { workerServiceHeaders } from "@/lib/worker-internal"

const log = createLogger("actions.media")

// ---------------------------------------------------------------------------
// Media Assets
// ---------------------------------------------------------------------------

export async function getMediaAssets(
  folder: string = "/",
  filter: "all" | "image" | "video" | "file" = "all"
) {
  const { organizationId } = await getSessionData()

  const conditions = [
    organizationId
      ? eq(mediaAssets.organizationId, organizationId)
      : isNull(mediaAssets.organizationId),
    eq(mediaAssets.folder, folder),
  ]

  if (filter !== "all") {
    conditions.push(eq(mediaAssets.type, filter))
  }

  return db.query.mediaAssets.findMany({
    where: and(...conditions),
    orderBy: [desc(mediaAssets.createdAt)],
  })
}

export async function getMediaAsset(id: string) {
  const { organizationId } = await getSessionData()
  if (!organizationId) throw new Error("No active organization")
  return db.query.mediaAssets.findFirst({
    where: and(eq(mediaAssets.id, id), eq(mediaAssets.organizationId, organizationId)),
  })
}

export async function deleteMediaAsset(id: string) {
  const { organizationId } = await getSessionData()

  if (!organizationId) {
    throw new Error("No active organization")
  }

  // Verify ownership
  const asset = await db.query.mediaAssets.findFirst({
    where: and(
      eq(mediaAssets.id, id),
      eq(mediaAssets.organizationId, organizationId)
    ),
  })

  if (!asset) {
    throw new Error("Asset not found")
  }

  // Delete from R2 via API route
  const workerUrl = process.env.WORKER_API_URL || "http://localhost:8787"
  try {
    await fetch(`${workerUrl}/internal/media/delete`, {
      method: "POST",
      headers: workerServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ key: asset.key }),
    })
  } catch (error) {
    log.error({ assetId: id, key: asset.key, err: error }, "failed to delete from R2")
  }

  await db.delete(mediaAssets).where(eq(mediaAssets.id, id))
  log.info({ id, key: asset.key, orgId: organizationId }, "media asset deleted")

  revalidatePath("/dashboard/media")
}

// ---------------------------------------------------------------------------
// Storage Usage
// ---------------------------------------------------------------------------

export async function getMediaStorageUsage() {
  const { organizationId } = await getSessionData()

  const [result] = await db
    .select({
      totalSize: sql<number>`COALESCE(SUM(${mediaAssets.size}), 0)`,
      totalFiles: sql<number>`COUNT(*)`,
    })
    .from(mediaAssets)
    .where(
      organizationId
        ? eq(mediaAssets.organizationId, organizationId)
        : isNull(mediaAssets.organizationId)
    )

  return {
    usedBytes: Number(result?.totalSize ?? 0),
    totalFiles: Number(result?.totalFiles ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Media Folders
// ---------------------------------------------------------------------------

export async function getMediaFolders(parentPath: string = "/") {
  const { organizationId } = await getSessionData()

  return db.query.mediaFolders.findMany({
    where: and(
      organizationId
        ? eq(mediaFolders.organizationId, organizationId)
        : isNull(mediaFolders.organizationId),
      eq(mediaFolders.parentPath, parentPath)
    ),
    orderBy: [mediaFolders.name],
  })
}

export async function createMediaFolder(name: string, parentPath: string = "/") {
  const { organizationId, userId } = await getSessionData()

  if (!organizationId) {
    throw new Error("No active organization")
  }

  // Validate
  const sanitized = name.trim()
  if (!sanitized || sanitized.length > 100) {
    throw new Error("Folder name must be between 1 and 100 characters")
  }
  if (/[/\\]/.test(sanitized)) {
    throw new Error("Folder name cannot contain slashes")
  }

  const fullPath = `${parentPath}${sanitized}/`

  // Check duplicates
  const existing = await db.query.mediaFolders.findFirst({
    where: and(
      eq(mediaFolders.organizationId, organizationId),
      eq(mediaFolders.path, fullPath)
    ),
  })

  if (existing) {
    throw new Error("A folder with this name already exists here")
  }

  const [folder] = await db
    .insert(mediaFolders)
    .values({
      name: sanitized,
      path: fullPath,
      parentPath,
      organizationId,
      createdBy: userId,
    })
    .returning()

  revalidatePath("/dashboard/media")
  return folder
}

export async function deleteMediaFolder(id: string) {
  const { organizationId } = await getSessionData()

  if (!organizationId) {
    throw new Error("No active organization")
  }

  const folder = await db.query.mediaFolders.findFirst({
    where: and(
      eq(mediaFolders.id, id),
      eq(mediaFolders.organizationId, organizationId)
    ),
  })

  if (!folder) {
    throw new Error("Folder not found")
  }

  // Check for files
  const fileInFolder = await db.query.mediaAssets.findFirst({
    where: and(
      eq(mediaAssets.organizationId, organizationId),
      eq(mediaAssets.folder, folder.path)
    ),
  })

  if (fileInFolder) {
    throw new Error("Cannot delete a folder that contains files")
  }

  // Check for sub-folders
  const subFolder = await db.query.mediaFolders.findFirst({
    where: and(
      eq(mediaFolders.organizationId, organizationId),
      eq(mediaFolders.parentPath, folder.path)
    ),
  })

  if (subFolder) {
    throw new Error("Cannot delete a folder that contains sub-folders")
  }

  await db.delete(mediaFolders).where(eq(mediaFolders.id, id))

  revalidatePath("/dashboard/media")
}

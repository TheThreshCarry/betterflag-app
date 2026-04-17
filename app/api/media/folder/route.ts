import { getSupabaseSession } from "@/lib/supabase/session";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import db from "@/lib/db";
import { mediaFolders, mediaAssets } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("api.media");

/**
 * POST /api/media/folder
 * Create a new folder.
 */
export async function POST(request: NextRequest) {
  try {
    let session
    try {
      session = await getSupabaseSession()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const { name, parentPath = "/" } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Validate folder name (no slashes, no dots starting, reasonable length)
    const sanitized = name.trim();
    if (sanitized.length === 0 || sanitized.length > 100) {
      return NextResponse.json(
        { error: "Folder name must be between 1 and 100 characters" },
        { status: 400 }
      );
    }
    if (/[/\\]/.test(sanitized)) {
      return NextResponse.json(
        { error: "Folder name cannot contain slashes" },
        { status: 400 }
      );
    }

    // Build the full path
    const fullPath = `${parentPath}${sanitized}/`;

    // Check for duplicates at the same level
    const existing = await db.query.mediaFolders.findFirst({
      where: and(
        eq(mediaFolders.organizationId, organizationId),
        eq(mediaFolders.path, fullPath)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: "A folder with this name already exists here" },
        { status: 409 }
      );
    }

    const [folder] = await db
      .insert(mediaFolders)
      .values({
        name: sanitized,
        path: fullPath,
        parentPath,
        organizationId,
        createdBy: session.userId,
      })
      .returning();

    return NextResponse.json({ success: true, folder });
  } catch (error) {
    log.error({ err: error }, "folder create error");
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/media/folder
 * Delete an empty folder.
 */
export async function DELETE(request: NextRequest) {
  try {
    let session
    try {
      session = await getSupabaseSession()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Folder ID is required" },
        { status: 400 }
      );
    }

    // Find the folder
    const folder = await db.query.mediaFolders.findFirst({
      where: and(
        eq(mediaFolders.id, id),
        eq(mediaFolders.organizationId, organizationId)
      ),
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // Check for files in this folder
    const fileInFolder = await db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.organizationId, organizationId),
        eq(mediaAssets.folder, folder.path)
      ),
    });

    if (fileInFolder) {
      return NextResponse.json(
        { error: "Cannot delete a folder that contains files" },
        { status: 400 }
      );
    }

    // Check for sub-folders
    const subFolder = await db.query.mediaFolders.findFirst({
      where: and(
        eq(mediaFolders.organizationId, organizationId),
        eq(mediaFolders.parentPath, folder.path)
      ),
    });

    if (subFolder) {
      return NextResponse.json(
        { error: "Cannot delete a folder that contains sub-folders" },
        { status: 400 }
      );
    }

    // Delete the folder
    await db.delete(mediaFolders).where(eq(mediaFolders.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "folder delete error");
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}

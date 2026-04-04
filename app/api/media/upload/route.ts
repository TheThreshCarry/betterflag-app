import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import db from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { PLAN_LIMITS } from "@/lib/polar/subscription";
import { getPlanSlugForUser } from "@/lib/polar/org-plan";
import { createLogger } from "@/lib/logger";
import { workerServiceHeaders } from "@/lib/worker-internal";

const log = createLogger("api.media");
const WORKER_URL = process.env.WORKER_API_URL || "http://localhost:8787";

/**
 * Derive the display type category from a MIME type.
 */
function deriveType(mimeType: string): "image" | "video" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string) || "/";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const planSlug = await getPlanSlugForUser(session.user.id);
    const limits = PLAN_LIMITS[planSlug];

    // 4. Check per-file size limit
    if (file.size > limits.mediaMaxFileSize) {
      const maxMB = Math.round(limits.mediaMaxFileSize / (1024 * 1024));
      return NextResponse.json(
        {
          error: `File size exceeds the ${maxMB}MB limit on the ${limits.name} plan. Upgrade for larger uploads.`,
          code: "FILE_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    // 5. Check total storage quota
    const [storageResult] = await db
      .select({
        totalSize: sql<number>`COALESCE(SUM(${mediaAssets.size}), 0)`,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.organizationId, organizationId));

    const currentUsage = Number(storageResult?.totalSize ?? 0);

    if (currentUsage + file.size > limits.mediaStorage) {
      const maxGB = limits.mediaStorage >= 1024 * 1024 * 1024
        ? `${(limits.mediaStorage / (1024 * 1024 * 1024)).toFixed(0)}GB`
        : `${(limits.mediaStorage / (1024 * 1024)).toFixed(0)}MB`;
      return NextResponse.json(
        {
          error: `Storage limit reached (${maxGB} on the ${limits.name} plan). Upgrade or delete existing files.`,
          code: "STORAGE_LIMIT_REACHED",
        },
        { status: 413 }
      );
    }

    // 6. Forward to Cloudflare Worker
    const workerFormData = new FormData();
    workerFormData.append("file", file);
    workerFormData.append("organizationId", organizationId);
    workerFormData.append("userId", session.user.id);
    workerFormData.append("folder", folder);

    const workerResponse = await fetch(`${WORKER_URL}/internal/media/upload`, {
      method: "POST",
      headers: workerServiceHeaders(),
      body: workerFormData,
    });

    const workerData = await workerResponse.json() as {
      success?: boolean;
      key?: string;
      name?: string;
      size?: number;
      mimeType?: string;
      error?: string;
    };

    if (!workerResponse.ok) {
      return NextResponse.json(workerData, { status: workerResponse.status });
    }

    // 7. Save metadata to database
    const mimeType = workerData.mimeType || file.type || "application/octet-stream";
    const publicUrl = `${WORKER_URL}/media/serve/${organizationId}/${workerData.key?.replace(`media/${organizationId}/`, "") || ""}`;

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        name: file.name,
        key: workerData.key!,
        url: publicUrl,
        folder,
        type: deriveType(mimeType),
        mimeType,
        size: file.size,
        organizationId,
        uploadedBy: session.user.id,
      })
      .returning();

    return NextResponse.json({
      success: true,
      asset,
    });
  } catch (error) {
    log.error({ err: error }, "media upload error");
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

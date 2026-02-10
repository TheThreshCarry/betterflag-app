import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import db from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";

const WORKER_URL = process.env.WORKER_API_URL || "http://localhost:8787";

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

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // 2. Find the asset and verify ownership
    const asset = await db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.id, id),
        eq(mediaAssets.organizationId, organizationId)
      ),
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    // 3. Delete from R2 via worker
    const workerResponse = await fetch(`${WORKER_URL}/media/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: asset.key }),
    });

    if (!workerResponse.ok) {
      const errorData = await workerResponse.json();
      console.error("Worker delete failed:", errorData);
      // Continue to delete DB record even if R2 delete fails
    }

    // 4. Delete from database
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Media delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

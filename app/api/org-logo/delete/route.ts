import { NextRequest, NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"
import { createAdminClient } from "@/lib/supabase/admin"
import { parsePublicStoragePath } from "@/lib/supabase/storage-brand"
import { requireOrganization } from "@/lib/supabase/session"

const log = createLogger("api.org-logo")
const BUCKET = "org-logos"

export async function DELETE(request: NextRequest) {
  try {
    let session
    try {
      session = await requireOrganization()
    } catch {
      return NextResponse.json(
        { error: "Unauthorized or no active organization" },
        { status: 401 }
      )
    }

    if (session.organizationRole !== "owner" && session.organizationRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json()) as { url?: string }
    const url = body.url
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No url provided" }, { status: 400 })
    }

    const path = parsePublicStoragePath(url, BUCKET, session.organizationId)
    if (!path) {
      return NextResponse.json({ error: "Invalid or unauthorized image url" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.storage.from(BUCKET).remove([path])

    if (error) {
      log.error({ err: error }, "org logo delete failed")
      return NextResponse.json(
        { error: error.message ?? "Delete failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: error }, "org logo delete error")
    return NextResponse.json({ error: "Failed to delete logo" }, { status: 500 })
  }
}

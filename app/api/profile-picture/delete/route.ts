import { getSupabaseSession } from "@/lib/supabase/session"
import { NextRequest, NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"
import { createAdminClient } from "@/lib/supabase/admin"
import { parsePublicStoragePath } from "@/lib/supabase/storage-brand"

const log = createLogger("api.profile")
const BUCKET = "avatars"

export async function DELETE(request: NextRequest) {
  try {
    let session
    try {
      session = await getSupabaseSession()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { url?: string }
    const url = body.url
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No url provided" }, { status: 400 })
    }

    const path = parsePublicStoragePath(url, BUCKET, session.userId)
    if (!path) {
      return NextResponse.json({ error: "Invalid or unauthorized image url" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.storage.from(BUCKET).remove([path])

    if (error) {
      log.error({ err: error }, "avatar delete failed")
      return NextResponse.json(
        { error: error.message ?? "Delete failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: error }, "profile picture delete error")
    return NextResponse.json(
      { error: "Failed to delete profile picture" },
      { status: 500 }
    )
  }
}

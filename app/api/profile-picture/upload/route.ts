import { NextRequest, NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  brandImageExt,
  validateBrandImageFile,
} from "@/lib/supabase/storage-brand"
import { getSupabaseSession } from "@/lib/supabase/session"

const log = createLogger("api.profile")
const BUCKET = "avatars"

export async function POST(request: NextRequest) {
  try {
    let session
    try {
      session = await getSupabaseSession()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const check = validateBrandImageFile(file)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    const ext = brandImageExt(file.type)
    if (!ext) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 })
    }

    const objectPath = `${session.userId}/${Date.now()}.${ext}`
    const admin = createAdminClient()
    const body = new Uint8Array(await file.arrayBuffer())

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, body, {
        contentType: file.type,
        upsert: false,
      })

    if (upErr) {
      log.error({ err: upErr }, "avatar upload failed")
      return NextResponse.json(
        { error: upErr.message ?? "Upload failed" },
        { status: 500 }
      )
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(objectPath)

    return NextResponse.json({
      success: true,
      url: pub.publicUrl,
    })
  } catch (error) {
    log.error({ err: error }, "profile picture upload error")
    return NextResponse.json(
      { error: "Failed to upload profile picture" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  brandImageExt,
  validateBrandImageFile,
} from "@/lib/supabase/storage-brand"
import { requireOrganization } from "@/lib/supabase/session"

const log = createLogger("api.org-logo")
const BUCKET = "org-logos"

export async function POST(request: NextRequest) {
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

    const orgId = session.organizationId
    const objectPath = `${orgId}/${Date.now()}.${ext}`
    const admin = createAdminClient()
    const body = new Uint8Array(await file.arrayBuffer())

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, body, {
        contentType: file.type,
        upsert: false,
      })

    if (upErr) {
      log.error({ err: upErr }, "org logo upload failed")
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
    log.error({ err: error }, "org logo upload error")
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 })
  }
}

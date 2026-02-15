import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { cmsMedia } from "@/lib/db/schema"

/**
 * GET /api/cms/media/:slug
 * Get CMS media by slug (headless CMS API).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const organizationId =
    request.headers.get("x-organization-id") ||
    request.nextUrl.searchParams.get("organizationId")

  try {
    const result = await db.query.cmsMedia.findFirst({
      where: and(
        organizationId
          ? eq(cmsMedia.organizationId, organizationId)
          : isNull(cmsMedia.organizationId),
        eq(cmsMedia.slug, slug)
      ),
    })

    if (!result) {
      return NextResponse.json(
        { error: "Media not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    )
  }
}

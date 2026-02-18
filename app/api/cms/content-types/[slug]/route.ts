import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { contentTypes } from "@/lib/db/schema"

/**
 * GET /api/cms/content-types/:slug
 * Get a content type by slug (headless CMS API).
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
    const result = await db.query.contentTypes.findFirst({
      where: and(
        organizationId
          ? eq(contentTypes.organizationId, organizationId)
          : isNull(contentTypes.organizationId),
        eq(contentTypes.slug, slug)
      ),
    })

    if (!result) {
      return NextResponse.json(
        { error: "Content type not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch content type" },
      { status: 500 }
    )
  }
}

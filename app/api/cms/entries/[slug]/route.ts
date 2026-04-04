import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { entries, contentTypes } from "@/lib/db/schema"
import { createLogger } from "@/lib/logger"

const log = createLogger("api.cms")

/**
 * GET /api/cms/entries/:slug
 * Get entry by slug (headless CMS API).
 * Requires ?contentType=<slug> to scope the entry lookup.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const organizationId =
    request.headers.get("x-organization-id") ||
    request.nextUrl.searchParams.get("organizationId")

  const contentTypeSlug = request.nextUrl.searchParams.get("contentType")

  try {
    // Resolve content type if provided
    let contentTypeId: string | undefined
    if (contentTypeSlug) {
      const ct = await db.query.contentTypes.findFirst({
        where: and(
          organizationId
            ? eq(contentTypes.organizationId, organizationId)
            : isNull(contentTypes.organizationId),
          eq(contentTypes.slug, contentTypeSlug)
        ),
      })
      if (!ct) {
        return NextResponse.json(
          { error: "Content type not found" },
          { status: 404 }
        )
      }
      contentTypeId = ct.id
    }

    const conditions = [
      organizationId
        ? eq(entries.organizationId, organizationId)
        : isNull(entries.organizationId),
      eq(entries.slug, slug),
    ]

    if (contentTypeId) {
      conditions.push(eq(entries.contentTypeId, contentTypeId))
    }

    const result = await db.query.entries.findFirst({
      where: and(...conditions),
      with: {
        contentType: true,
        entryRelations: true,
      },
    })

    if (!result) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    log.error({ err: error, slug }, "failed to fetch entry by slug")
    return NextResponse.json(
      { error: "Failed to fetch entry" },
      { status: 500 }
    )
  }
}

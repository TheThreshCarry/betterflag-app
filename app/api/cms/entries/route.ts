import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull, desc } from "drizzle-orm"
import db from "@/lib/db"
import { entries, contentTypes } from "@/lib/db/schema"

/**
 * GET /api/cms/entries
 * List entries (headless CMS API).
 * Query params: organizationId, contentType (slug), status, limit, offset
 */
export async function GET(request: NextRequest) {
  const organizationId =
    request.headers.get("x-organization-id") ||
    request.nextUrl.searchParams.get("organizationId")

  const contentTypeSlug = request.nextUrl.searchParams.get("contentType")
  const statusFilter = request.nextUrl.searchParams.get("status") || "published"
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10)
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10)

  try {
    // If a content type slug is provided, resolve it to an ID
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
      eq(entries.status, statusFilter as "draft" | "published" | "archived"),
    ]

    if (contentTypeId) {
      conditions.push(eq(entries.contentTypeId, contentTypeId))
    }

    const results = await db.query.entries.findMany({
      where: and(...conditions),
      orderBy: [desc(entries.createdAt)],
      limit,
      offset,
      with: {
        contentType: true,
      },
    })

    return NextResponse.json({ data: results })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch entries" },
      { status: 500 }
    )
  }
}

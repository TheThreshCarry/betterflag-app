import { NextRequest, NextResponse } from "next/server"
import { eq, and, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { contentTypes } from "@/lib/db/schema"

/**
 * GET /api/cms/content-types
 * List content types for an organization (headless CMS API).
 * Requires x-organization-id header or ?organizationId query param.
 */
export async function GET(request: NextRequest) {
  const organizationId =
    request.headers.get("x-organization-id") ||
    request.nextUrl.searchParams.get("organizationId")

  const statusFilter = request.nextUrl.searchParams.get("status") || "active"

  try {
    const results = await db.query.contentTypes.findMany({
      where: and(
        organizationId
          ? eq(contentTypes.organizationId, organizationId)
          : isNull(contentTypes.organizationId),
        eq(contentTypes.status, statusFilter as "draft" | "active" | "deprecated")
      ),
    })

    return NextResponse.json({ data: results })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch content types" },
      { status: 500 }
    )
  }
}

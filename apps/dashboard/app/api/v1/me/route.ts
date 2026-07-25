/**
 * GET /api/v1/me — current user's profile (avatar, etc.).
 * Session-only.
 */
import { NextResponse, type NextRequest } from "next/server";

import { toApiProfile } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/db";
import { HttpError, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const GET = withErrors(async (request: NextRequest) => {
  const header = request.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "session_required", "Profile endpoints require a signed-in session");
  }
  const { userId, email } = await resolveSessionUser();
  const service = createServiceClient();
  const profile = await getOrCreateProfile(service, userId);
  return NextResponse.json({
    profile: toApiProfile(profile),
    email,
  });
});

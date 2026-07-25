/**
 * POST /api/v1/me/avatar — upload profile picture (multipart file).
 * DELETE /api/v1/me/avatar — clear profile picture.
 * Session-only; user can only mutate their own profile.
 */
import type { ProfileRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiProfile } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/db";
import { unwrap, withErrors } from "@/lib/errors";
import { parseMediaUpload, requireSessionOnly } from "@/lib/media-upload";
import {
  deleteMediaObject,
  keyFromPublicUrl,
  profileAvatarKey,
  putPublicImage,
} from "@/lib/r2";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const POST = withErrors(async (request: NextRequest) => {
  requireSessionOnly(request);
  const { userId } = await resolveSessionUser();
  const service = createServiceClient();
  const profile = await getOrCreateProfile(service, userId);
  const file = await parseMediaUpload(request);

  const key = profileAvatarKey(userId, file.ext);
  const previousKey = keyFromPublicUrl(profile.avatar_url);
  const avatarUrl = await putPublicImage({
    key,
    body: file.buffer,
    contentType: file.contentType,
  });

  if (previousKey && previousKey !== key) {
    await deleteMediaObject(previousKey);
  }

  const updated = unwrap(
    await service
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single(),
  ) as ProfileRow;

  return NextResponse.json({ profile: toApiProfile(updated) });
});

export const DELETE = withErrors(async (request: NextRequest) => {
  requireSessionOnly(request);
  const { userId } = await resolveSessionUser();
  const service = createServiceClient();
  const profile = await getOrCreateProfile(service, userId);

  const previousKey = keyFromPublicUrl(profile.avatar_url);
  if (previousKey) await deleteMediaObject(previousKey);

  const updated = unwrap(
    await service
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single(),
  ) as ProfileRow;

  return NextResponse.json({ profile: toApiProfile(updated) });
});

import type { ApiKeyRow } from "@shipos/db";
import type { NextRequest } from "next/server";

import { toApiApiKey, type ApiApiKey } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { HttpError, unwrap } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const KEY_COLUMNS =
  "id, org_id, project_id, environment_id, kind, name, prefix, scopes, source, last_used_at, created_by, created_at, revoked_at";

/** Keys are dashboard-only, bearer tokens cannot hit key endpoints. */
export function rejectKeysBearer(request: NextRequest): void {
  const header = request.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(
      401,
      "session_required",
      "API key management requires a signed-in dashboard session",
    );
  }
}

export async function loadOrgKeys(): Promise<ApiApiKey[]> {
  const { userId } = await resolveSessionUser();
  const service = createServiceClient();

  const { data: memberships, error: membershipError } = await service
    .from("org_members")
    .select("org_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (membershipError) throw membershipError;

  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return [];

  const rows = unwrap(
    await service
      .from("api_keys")
      .select(KEY_COLUMNS)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ) as Omit<ApiKeyRow, "hash">[];

  return rows.map((row) => toApiApiKey({ ...row, hash: "" }));
}

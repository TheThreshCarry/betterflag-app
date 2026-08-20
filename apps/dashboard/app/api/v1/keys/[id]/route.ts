import type { ApiKeyRow, EnvironmentRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiApiKey } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { kvPutSdkKey, sdkKeyKvEntry } from "@/lib/cloudflare";
import { getOrg, recordAudit } from "@/lib/db";
import { HttpError, unwrap, withErrors } from "@/lib/errors";
import { rejectKeysBearer } from "@/lib/keys";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function resolveSessionOrgId(userId: string): Promise<string> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("org_members")
    .select("org_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const orgId = data?.[0]?.org_id;
  if (!orgId) {
    throw new HttpError(403, "no_org", "You are not a member of any organization yet");
  }
  return orgId;
}

export const DELETE = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  rejectKeysBearer(request);
  const { id } = await params;
  const { userId } = await resolveSessionUser();
  const orgId = await resolveSessionOrgId(userId);
  const service = createServiceClient();
  await assertOrgWritable(service, orgId);

  const { data, error } = await service
    .from("api_keys")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  const key = data as ApiKeyRow | null;
  if (!key) throw new HttpError(404, "key_not_found", "API key not found");

  if (key.revoked_at !== null) {
    return NextResponse.json({ ok: true });
  }

  const revoked = unwrap(
    await service
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", key.id)
      .select("*")
      .single(),
  ) as ApiKeyRow;

  // SDK keys: flip the KV entry so the edge rejects the key within seconds.
  if (key.kind === "sdk" && key.project_id && key.environment_id) {
    const { data: envData, error: envError } = await service
      .from("environments")
      .select("*")
      .eq("id", key.environment_id)
      .maybeSingle();
    if (envError) throw envError;
    const environment = envData as EnvironmentRow | null;
    if (environment) {
      const org = await getOrg(service, key.org_id);
      await kvPutSdkKey(
        key.prefix,
        sdkKeyKvEntry({
          orgId: key.org_id,
          projectId: key.project_id,
          envSlug: environment.slug,
          hash: key.hash,
          revoked: true,
          plan: org.plan,
        }),
      );
    }
  }

  await recordAudit(service, {
    orgId,
    projectId: key.project_id,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "key.revoke",
    subject: `key:${key.prefix}`,
    before: toApiApiKey(key),
    after: toApiApiKey(revoked),
  });

  return NextResponse.json({ ok: true });
});

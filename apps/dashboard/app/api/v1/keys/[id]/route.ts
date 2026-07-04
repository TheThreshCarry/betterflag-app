import type { SdkKeyKvEntry } from "@shipos/core";
import type { ApiKeyRow, EnvironmentRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";

import { toApiApiKey } from "@/lib/api-types";
import { auditActor, resolveActor } from "@/lib/auth";
import { kvPutSdkKey } from "@/lib/cloudflare";
import { recordAudit } from "@/lib/db";
import { HttpError, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const DELETE = withErrors<{ id: string }>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const actor = await resolveActor(request);
  const service = createServiceClient();

  const { data, error } = await service
    .from("api_keys")
    .select("*")
    .eq("id", id)
    .eq("org_id", actor.orgId)
    .maybeSingle();
  if (error) throw error;
  const key = data as ApiKeyRow | null;
  if (!key) throw new HttpError(404, "key_not_found", "API key not found");

  if (key.revoked_at !== null) {
    // Idempotent: already revoked.
    return NextResponse.json({ apiKey: toApiApiKey(key) });
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
      const entry: SdkKeyKvEntry = {
        orgId: key.org_id,
        projectId: key.project_id,
        envSlug: environment.slug,
        hash: key.hash,
        revoked: true,
      };
      await kvPutSdkKey(key.prefix, entry);
    }
  }

  await recordAudit(service, {
    orgId: actor.orgId,
    projectId: key.project_id,
    actor: auditActor(actor),
    action: "key.revoke",
    subject: `key:${key.prefix}`,
    before: toApiApiKey(key),
    after: toApiApiKey(revoked),
  });

  return NextResponse.json({ apiKey: toApiApiKey(revoked) });
});

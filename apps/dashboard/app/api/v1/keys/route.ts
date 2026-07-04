import { formatApiKey, keyPrefixOf, sha256Hex, type SdkKeyKvEntry } from "@shipos/core";
import { PLAN_LIMITS, type ApiKeyRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiApiKey } from "@/lib/api-types";
import { auditActor, resolveActor } from "@/lib/auth";
import { kvPutSdkKey } from "@/lib/cloudflare";
import { getEnvironmentInProject, getOrg, getProjectInOrg, recordAudit } from "@/lib/db";
import { HttpError, parseJson, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const KEY_COLUMNS =
  "id, org_id, project_id, environment_id, kind, name, prefix, scopes, last_used_at, created_by, created_at, revoked_at";

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const service = createServiceClient();

  const rows = unwrap(
    await service
      .from("api_keys")
      .select(KEY_COLUMNS)
      .eq("org_id", actor.orgId)
      .order("created_at", { ascending: false }),
  ) as Omit<ApiKeyRow, "hash">[];

  return NextResponse.json({
    keys: rows.map((row) => toApiApiKey({ ...row, hash: "" })),
  });
});

const createKeySchema = z
  .object({
    kind: z.enum(["sdk", "agent", "admin"]),
    name: z.string().min(1).max(120),
    projectId: z.uuid().optional(),
    environmentId: z.uuid().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.kind === "sdk") {
      if (!body.projectId) {
        ctx.addIssue({ code: "custom", path: ["projectId"], message: "sdk keys require projectId" });
      }
      if (!body.environmentId) {
        ctx.addIssue({
          code: "custom",
          path: ["environmentId"],
          message: "sdk keys require environmentId",
        });
      }
    }
  });

function randomHex40(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const POST = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const body = await parseJson(request, createKeySchema);
  const service = createServiceClient();

  let envSlug: string | null = null;
  if (body.projectId) {
    await getProjectInOrg(service, body.projectId, actor.orgId);
  }
  if (body.kind === "sdk" && body.projectId && body.environmentId) {
    const environment = await getEnvironmentInProject(service, body.environmentId, body.projectId);
    envSlug = environment.slug;
  }

  if (body.kind === "agent") {
    const org = await getOrg(service, actor.orgId);
    const limit = PLAN_LIMITS[org.plan].agentKeys;
    if (limit !== null) {
      const { count, error } = await service
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("org_id", actor.orgId)
        .eq("kind", "agent")
        .is("revoked_at", null);
      if (error) throw error;
      if ((count ?? 0) >= limit) {
        throw new HttpError(
          403,
          "plan_limit",
          `The ${org.plan} plan includes ${limit} agent key${limit === 1 ? "" : "s"}. Revoke one or upgrade to add more.`,
        );
      }
    }
  }

  const plaintext = formatApiKey(body.kind, randomHex40());
  const prefix = keyPrefixOf(plaintext);
  const hash = await sha256Hex(plaintext);

  const inserted = unwrap(
    await service
      .from("api_keys")
      .insert({
        org_id: actor.orgId,
        project_id: body.projectId ?? null,
        environment_id: body.kind === "sdk" ? (body.environmentId ?? null) : null,
        kind: body.kind,
        name: body.name,
        hash,
        prefix,
        created_by: actor.type === "user" ? actor.userId : null,
      })
      .select(KEY_COLUMNS)
      .single(),
  ) as Omit<ApiKeyRow, "hash">;

  // SDK keys are resolved by the edge from KV — never from Postgres.
  if (body.kind === "sdk" && body.projectId && envSlug) {
    const entry: SdkKeyKvEntry = {
      orgId: actor.orgId,
      projectId: body.projectId,
      envSlug,
      hash,
      revoked: false,
    };
    await kvPutSdkKey(prefix, entry);
  }

  const apiKey = toApiApiKey({ ...inserted, hash: "" });
  await recordAudit(service, {
    orgId: actor.orgId,
    projectId: body.projectId ?? null,
    actor: auditActor(actor),
    action: "key.create",
    subject: `key:${prefix}`,
    after: apiKey,
  });

  return NextResponse.json({ apiKey, plaintext }, { status: 201 });
});

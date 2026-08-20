import { formatApiKey, keyPrefixOf, sha256Hex } from "@betterflag/core";
import { PLAN_LIMITS, type ApiKeyRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiApiKey } from "@/lib/api-types";
import { resolveSessionUser } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { kvPutSdkKey, sdkKeyKvEntry } from "@/lib/cloudflare";
import { getEnvironmentInProject, getOrg, getProjectInOrg, recordAudit } from "@/lib/db";
import { HttpError, parseJson, unwrap, withErrors } from "@/lib/errors";
import { KEY_COLUMNS, rejectKeysBearer } from "@/lib/keys";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

export const POST = withErrors(async (request: NextRequest) => {
  rejectKeysBearer(request);
  const { userId } = await resolveSessionUser();
  const orgId = await resolveSessionOrgId(userId);
  const body = await parseJson(request, createKeySchema);
  const service = createServiceClient();
  await assertOrgWritable(service, orgId);

  let envSlug: string | null = null;
  if (body.projectId) {
    await getProjectInOrg(service, body.projectId, orgId);
  }
  if (body.kind === "sdk" && body.projectId && body.environmentId) {
    const environment = await getEnvironmentInProject(service, body.environmentId, body.projectId);
    envSlug = environment.slug;
  }

  if (body.kind === "agent") {
    const org = await getOrg(service, orgId);
    const limit = PLAN_LIMITS[org.plan].agentKeys;
    if (limit !== null) {
      const { count, error } = await service
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("kind", "agent")
        // OAuth-connection keys are exempt from the plan agent-key limit.
        .eq("source", "manual")
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
        org_id: orgId,
        project_id: body.projectId ?? null,
        environment_id: body.kind === "sdk" ? (body.environmentId ?? null) : null,
        kind: body.kind,
        name: body.name,
        hash,
        prefix,
        created_by: userId,
      })
      .select(KEY_COLUMNS)
      .single(),
  ) as Omit<ApiKeyRow, "hash">;

  // SDK keys are resolved by the edge from KV, never from Postgres.
  if (body.kind === "sdk" && body.projectId && envSlug) {
    const org = await getOrg(service, orgId);
    await kvPutSdkKey(
      prefix,
      sdkKeyKvEntry({
        orgId,
        projectId: body.projectId,
        envSlug,
        hash,
        revoked: false,
        plan: org.plan,
      }),
    );
  }

  const apiKey = toApiApiKey({ ...inserted, hash: "" });
  await recordAudit(service, {
    orgId,
    projectId: body.projectId ?? null,
    actor: { actorType: "user", actorId: userId, actorKeyPrefix: null },
    action: "key.create",
    subject: `key:${prefix}`,
    after: apiKey,
  });

  return NextResponse.json({ apiKey, plaintext }, { status: 201 });
});

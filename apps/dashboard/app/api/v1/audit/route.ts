import type { AuditLogRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiAuditEntry } from "@/lib/api-types";
import { resolveActor } from "@/lib/auth";
import { parseQuery, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const auditQuerySchema = z.object({
  actorType: z.enum(["user", "agent"]).optional(),
  projectId: z.uuid().optional(),
  /** Exact subject match, e.g. `flag:my-flag`. */
  subject: z.string().min(1).max(200).optional(),
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const query = parseQuery(request, auditQuerySchema.passthrough()) as z.infer<
    typeof auditQuerySchema
  >;
  const service = createServiceClient();

  let dbQuery = service
    .from("audit_log")
    .select("*")
    .eq("org_id", actor.orgId)
    .order("created_at", { ascending: false })
    .limit(query.limit);
  if (query.actorType) dbQuery = dbQuery.eq("actor_type", query.actorType);
  if (query.projectId) dbQuery = dbQuery.eq("project_id", query.projectId);
  if (query.subject) dbQuery = dbQuery.eq("subject", query.subject);
  if (query.before) dbQuery = dbQuery.lt("created_at", query.before);

  const rows = unwrap(await dbQuery) as AuditLogRow[];

  return NextResponse.json({ entries: rows.map(toApiAuditEntry) });
});

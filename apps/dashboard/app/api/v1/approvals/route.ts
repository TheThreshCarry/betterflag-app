import type { ApprovalRow } from "@shipos/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toApiApproval } from "@/lib/api-types";
import { resolveActor } from "@/lib/auth";
import { parseQuery, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const approvalsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  const query = parseQuery(request, approvalsQuerySchema.passthrough()) as z.infer<
    typeof approvalsQuerySchema
  >;
  const service = createServiceClient();

  let dbQuery = service
    .from("approvals")
    .select("*")
    .eq("org_id", actor.orgId)
    .order("created_at", { ascending: false })
    .limit(query.limit);
  if (query.status) dbQuery = dbQuery.eq("status", query.status);

  const rows = unwrap(await dbQuery) as ApprovalRow[];

  return NextResponse.json({ approvals: rows.map(toApiApproval) });
});

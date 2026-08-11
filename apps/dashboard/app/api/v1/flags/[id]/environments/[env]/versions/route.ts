/**
 * GET /api/v1/flags/:id/environments/:env/versions
 *
 * Config version history for one flag + env, derived from audit_log
 * (flag.config.update / flag.kill — each bumps version).
 */
import type { AuditLogRow } from "@betterflag/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { assertKeyScope, resolveActor } from "@/lib/auth";
import { getEnvironmentBySlug, getFlagConfig, getFlagInOrg } from "@/lib/db";
import { parseQuery, unwrap, withErrors } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const versionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

type ConfigSnapshot = {
  version?: number;
  environment_id?: string;
  enabled?: boolean;
  killed?: boolean;
  rollout_pct?: number;
};

function asSnapshot(value: unknown): ConfigSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ConfigSnapshot;
}

function summarizeChange(action: string, before: ConfigSnapshot | null, after: ConfigSnapshot | null): string {
  if (action === "flag.kill" || after?.killed) return "Kill switch";
  if (before?.killed && after && !after.killed) return "Cleared kill";
  if (before && after) {
    if (before.enabled !== after.enabled) {
      return after.enabled ? "Enabled" : "Disabled";
    }
    if (before.rollout_pct !== after.rollout_pct) {
      return `Rollout ${after.rollout_pct ?? 0}%`;
    }
  }
  return "Config updated";
}

export const GET = withErrors<{ id: string; env: string }>(
  async (request: NextRequest, { params }) => {
    const { id, env: envSlug } = await params;
    const actor = await resolveActor(request);
    const { limit } = parseQuery(request, versionsQuerySchema);
    const service = createServiceClient();

    const { flag, project } = await getFlagInOrg(service, id, actor.orgId);
    assertKeyScope(actor, project.id);
    const environment = await getEnvironmentBySlug(service, project.id, envSlug);
    const config = await getFlagConfig(service, flag.id, environment.id);

    // Fetch a wider window then filter by env — jsonb env filter is awkward
    // across PostgREST versions; flag+env history is usually small.
    const rows = unwrap(
      await service
        .from("audit_log")
        .select("*")
        .eq("org_id", actor.orgId)
        .eq("project_id", project.id)
        .eq("subject", `flag:${flag.key}`)
        .in("action", ["flag.config.update", "flag.kill"])
        .order("created_at", { ascending: false })
        .limit(100),
    ) as AuditLogRow[];

    const matched = rows
      .map((row) => {
        const before = asSnapshot(row.before);
        const after = asSnapshot(row.after);
        if (!after || after.environment_id !== environment.id) return null;
        if (typeof after.version !== "number") return null;
        return { row, before, after };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .slice(0, limit);

    // Resolve human emails once per distinct actor_id (service-role admin API).
    const userIds = [
      ...new Set(
        matched
          .map(({ row }) =>
            row.actor_type === "user" && row.actor_id ? row.actor_id : null,
          )
          .filter((id): id is string => id !== null),
      ),
    ];
    const emailByUserId = new Map<string, string | null>();
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { data } = await service.auth.admin.getUserById(userId);
          emailByUserId.set(userId, data.user?.email ?? null);
        } catch {
          emailByUserId.set(userId, null);
        }
      }),
    );

    const versions = matched.map(({ row, before, after }) => ({
      version: after.version as number,
      action: row.action,
      summary: summarizeChange(row.action, before, after),
      actorType: row.actor_type,
      actorKeyPrefix: row.actor_key_prefix,
      actorEmail:
        row.actor_type === "user" && row.actor_id
          ? (emailByUserId.get(row.actor_id) ?? null)
          : null,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      flagKey: flag.key,
      env: envSlug,
      currentVersion: config.version,
      versions,
    });
  },
);

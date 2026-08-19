/**
 * Snapshot rebuild + push. Synchronous KV write so enable / kill / promote
 * land at the edge in seconds (queue-only sync can take minutes). Always
 * enqueues config-sync afterward for reconciliation. Ingest rebuilds with
 * the same `buildSnapshot`, so the two paths cannot drift.
 */

import { buildSnapshot, type FlagConfigRowLike, type FlagRowLike } from "@betterflag/core";
import type { FlagConfigRow, FlagRow } from "@betterflag/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueConfigSync, kvPutSnapshot } from "./cloudflare";
import { unwrap } from "./errors";
import { withBusinessSpan } from "./observability";

export async function rebuildAndPushSnapshot(
  service: SupabaseClient,
  projectId: string,
  environmentId: string,
  envSlug: string,
  orgId: string,
): Promise<void> {
  const flagRows = unwrap(
    await service
      .from("flags")
      .select("id, key, kind, default_value, archived_at")
      .eq("project_id", projectId)
      .is("archived_at", null),
  ) as Pick<FlagRow, "id" | "key" | "kind" | "default_value" | "archived_at">[];

  const configRows =
    flagRows.length === 0
      ? []
      : (unwrap(
          await service
            .from("flag_configs")
            .select("*")
            .eq("environment_id", environmentId)
            .in(
              "flag_id",
              flagRows.map((f) => f.id),
            ),
        ) as FlagConfigRow[]);

  const keyByFlagId = new Map(flagRows.map((f) => [f.id, f.key]));

  const flags: FlagRowLike[] = flagRows.map((f) => ({
    key: f.key,
    kind: f.kind,
    default_value: f.default_value,
    archived_at: f.archived_at,
  }));

  const configs: FlagConfigRowLike[] = [];
  for (const config of configRows) {
    const flagKey = keyByFlagId.get(config.flag_id);
    if (!flagKey) continue;
    configs.push({
      flag_key: flagKey,
      enabled: config.enabled,
      killed: config.killed,
      rollout_pct: config.rollout_pct,
      rules: config.rules,
      value_on: config.value_on,
      value_off: config.value_off,
      version: config.version,
    });
  }

  const { snapshot, invalidRules } = buildSnapshot({
    projectId,
    environment: envSlug,
    version: Date.now(),
    generatedAt: new Date().toISOString(),
    flags,
    configs,
  });

  if (invalidRules.length > 0) {
    console.warn(
      `[sync] dropped invalid rules while rebuilding ${projectId}/${envSlug}:`,
      invalidRules,
    );
  }

  await withBusinessSpan("kv.put_snapshot", () => kvPutSnapshot(projectId, envSlug, JSON.stringify(snapshot)), {
    project_id: projectId,
    env: envSlug,
  });
  // Reconciliation message so the ingest worker converges KV even if the
  // direct write above raced or failed.
  enqueueConfigSync({ projectId, environmentId, envSlug, orgId });
}

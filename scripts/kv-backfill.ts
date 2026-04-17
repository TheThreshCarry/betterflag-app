#!/usr/bin/env bun
/**
 * KV backfill — for every organization, read flags/configs/entries from
 * Supabase (service role) and push each into Cloudflare KV via the Worker's
 * internal `/internal/kv/*` endpoint.
 *
 * Run once after Phase 2 cutover so the edge has everything it needs.
 *
 * Usage:
 *   bun run scripts/kv-backfill.ts           # all orgs, all surfaces
 *   bun run scripts/kv-backfill.ts --org=<id>
 *   bun run scripts/kv-backfill.ts --only=flags,configs,cms
 */
import "dotenv/config"
import { createAdminClient } from "../lib/supabase/admin"
import {
  KVKeys,
  syncConfigTenant,
  syncCmsEntryTenant,
  syncCmsIndexTenant,
  syncFlagsTenant,
} from "../lib/sync/kv-sync"

const args = process.argv.slice(2)
const filterOrg = args.find((a) => a.startsWith("--org="))?.split("=")[1]
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",") ?? [
  "flags",
  "configs",
  "cms",
]

const supabase = createAdminClient()

async function main() {
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, slug")
    .order("created_at", { ascending: true })
  if (error) throw error

  const target = filterOrg ? orgs!.filter((o) => o.id === filterOrg) : orgs!
  console.log(`[kv-backfill] ${target.length} organizations, surfaces=${only.join(",")}`)

  let flagOps = 0
  let configOps = 0
  let cmsOps = 0

  for (const org of target) {
    const orgId = org.id as string

    if (only.includes("flags")) {
      const { data: flags } = await supabase
        .from("feature_flags")
        .select("key, enabled, environment")
        .eq("organization_id", orgId)
      const byEnv: Record<string, Record<string, boolean>> = {}
      for (const f of flags ?? []) {
        const env = (f.environment as string) ?? "production"
        ;(byEnv[env] ??= {})[f.key as string] = Boolean(f.enabled)
      }
      await syncFlagsTenant(orgId, byEnv)
      flagOps += 1
    }

    if (only.includes("configs")) {
      const { data: configs } = await supabase
        .from("global_configs")
        .select("slug, data, environment")
        .eq("organization_id", orgId)
      for (const c of configs ?? []) {
        await syncConfigTenant(orgId, c.slug as string, (c.data as Record<string, unknown>) ?? {})
        configOps += 1
      }
    }

    if (only.includes("cms")) {
      const { data: cts } = await supabase
        .from("content_types")
        .select("id, slug")
        .eq("organization_id", orgId)
      for (const ct of cts ?? []) {
        const { data: entries } = await supabase
          .from("entries")
          .select("slug, data, status, updated_at")
          .eq("organization_id", orgId)
          .eq("content_type_id", ct.id as string)
          .eq("status", "published")
        const index: Array<{ slug: string; updatedAt?: string }> = []
        for (const e of entries ?? []) {
          await syncCmsEntryTenant(orgId, ct.slug as string, e.slug as string, {
            data: e.data,
          })
          index.push({
            slug: e.slug as string,
            updatedAt: e.updated_at as string | undefined,
          })
          cmsOps += 1
        }
        await syncCmsIndexTenant(orgId, ct.slug as string, index)
      }
    }
  }

  console.log(
    `[kv-backfill] done flags=${flagOps} configs=${configOps} cms=${cmsOps} keyScheme=${KVKeys.flagsTenant("_")}`,
  )
}

main().catch((err) => {
  console.error("[kv-backfill] failed:", err)
  process.exit(1)
})

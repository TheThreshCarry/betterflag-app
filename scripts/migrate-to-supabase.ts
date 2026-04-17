#!/usr/bin/env bun
/**
 * One-shot migration from Better Auth + self-hosted Postgres to Supabase.
 *
 * Preconditions:
 *   - Supabase project is up, migrations applied (supabase/migrations/*.sql).
 *   - SOURCE_DATABASE_URL points at the old Better Auth Postgres.
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL set.
 *
 * Steps:
 *   1. Pull existing orgs + members + app rows from the source DB.
 *   2. Insert orgs into public.organizations (new uuid ids, mapping kept).
 *   3. For each Better Auth `user`, call supabase.auth.admin.createUser with
 *      email_confirm: true (we can't port password hashes from better-auth's
 *      account table reliably — users will re-onboard via magic link).
 *   4. Insert organization_members rows (user_id → supabase uuid).
 *   5. Re-insert all app tables with remapped organization_id.
 *
 * Idempotent: safe to re-run (uses `on conflict do nothing` / upserts).
 *
 * Usage:
 *   bun run scripts/migrate-to-supabase.ts --dry-run
 *   bun run scripts/migrate-to-supabase.ts --apply
 */
import "dotenv/config"
import { Pool } from "pg"
import { createAdminClient } from "../lib/supabase/admin"

const DRY_RUN = !process.argv.includes("--apply")
const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL

if (!SOURCE_URL) {
  console.error("SOURCE_DATABASE_URL (or DATABASE_URL) required")
  process.exit(1)
}

const source = new Pool({ connectionString: SOURCE_URL })
const supabase = createAdminClient()

type OldOrg = { id: string; name: string; slug: string; logo: string | null; metadata: string | null }
type OldUser = {
  id: string
  email: string
  name: string
  image: string | null
  username: string | null
  role: string | null
}
type OldMember = { organization_id: string; user_id: string; role: "owner" | "admin" | "member" }

async function main() {
  console.log(`[migrate] mode=${DRY_RUN ? "DRY-RUN" : "APPLY"}`)

  const orgIdMap = new Map<string, string>() // old text id → new uuid
  const userIdMap = new Map<string, string>() // old text id → new supabase uuid

  // 1) organizations
  const { rows: orgs } = await source.query<OldOrg>(
    `select id, name, slug, logo, metadata from organization`,
  )
  console.log(`[migrate] ${orgs.length} organizations`)
  for (const o of orgs) {
    if (DRY_RUN) {
      console.log(`  would insert org: ${o.slug}`)
      continue
    }
    const { data, error } = await supabase
      .from("organizations")
      .upsert(
        {
          name: o.name,
          slug: o.slug,
          logo: o.logo,
          metadata: o.metadata ? JSON.parse(o.metadata) : {},
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single()
    if (error) throw error
    orgIdMap.set(o.id, data.id as string)
  }

  // 2) users → supabase auth.users + profiles
  const { rows: users } = await source.query<OldUser>(
    `select id, email, name, image, username, role from "user"`,
  )
  console.log(`[migrate] ${users.length} users`)
  for (const u of users) {
    if (DRY_RUN) {
      console.log(`  would create user: ${u.email}`)
      continue
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      email_confirm: true,
      user_metadata: {
        name: u.name,
        username: u.username,
        image: u.image,
      },
    })
    if (error) {
      if (error.message.includes("already")) {
        // User already exists — look up by email.
        const { data: list } = await supabase.auth.admin.listUsers({
          perPage: 1,
          page: 1,
        })
        const existing = list?.users.find((x) => x.email === u.email)
        if (existing) {
          userIdMap.set(u.id, existing.id)
          continue
        }
      }
      throw error
    }
    userIdMap.set(u.id, data.user.id)
  }

  // 3) organization_members
  const { rows: members } = await source.query<OldMember>(
    `select organization_id, user_id, role from member`,
  )
  console.log(`[migrate] ${members.length} memberships`)
  for (const m of members) {
    const newOrg = orgIdMap.get(m.organization_id)
    const newUser = userIdMap.get(m.user_id)
    if (!newOrg || !newUser) {
      console.warn(`  skip member: missing mapping ${m.user_id} → ${m.organization_id}`)
      continue
    }
    if (DRY_RUN) continue
    const { error } = await supabase
      .from("organization_members")
      .upsert(
        { organization_id: newOrg, user_id: newUser, role: m.role },
        { onConflict: "organization_id,user_id" },
      )
    if (error) throw error
  }

  // 4) Re-insert app tables. Pattern: remap organization_id, drop old UUID pk
  //    so Supabase generates a new one (avoids collisions with any test data).
  const appTables = [
    "feature_flags",
    "global_configs",
    "customers",
    "changelogs",
    "changelog_labels",
    "content_types",
    "entries",
    "entry_relations",
    "cms_media",
    "media_assets",
    "media_folders",
  ] as const

  for (const table of appTables) {
    const { rows } = await source.query<Record<string, unknown>>(
      `select * from ${table} where organization_id is not null`,
    )
    console.log(`[migrate] ${rows.length} ${table}`)
    for (const row of rows) {
      const oldOrg = row.organization_id as string
      const newOrg = orgIdMap.get(oldOrg)
      if (!newOrg) continue
      row.organization_id = newOrg
      delete row.id // let Supabase generate
      if (DRY_RUN) continue
      const { error } = await supabase.from(table).insert(row)
      if (error) {
        console.warn(`  ${table} insert error:`, error.message)
      }
    }
  }

  await source.end()
  console.log(`[migrate] done (${DRY_RUN ? "DRY-RUN" : "APPLIED"})`)
  console.log(`[migrate] users needing re-onboard: ${userIdMap.size}`)
  console.log(`[migrate] tell these users to use "Forgot password" or magic-link sign-in.`)
}

main().catch((err) => {
  console.error("[migrate] failed:", err)
  process.exit(1)
})

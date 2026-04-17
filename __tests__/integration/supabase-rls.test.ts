/**
 * RLS policy integration tests.
 *
 * Requires a running Supabase stack (local CLI or a dedicated test project)
 * with the migrations in supabase/migrations/*.sql applied.
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Skips gracefully when not configured so the suite doesn't block CI.
 */
import { beforeAll, describe, expect, it } from "vitest"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const skip = !URL || !ANON || !SERVICE

describe.skipIf(skip)("Supabase RLS: tenant isolation", () => {
  const admin = createSupabaseClient(URL!, SERVICE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let orgA = ""
  let orgB = ""
  let userA: { id: string; email: string; accessToken: string }
  let userB: { id: string; email: string; accessToken: string }

  const password = "p@ssw0rd-test-1234!"

  beforeAll(async () => {
    // two orgs
    const { data: a } = await admin
      .from("organizations")
      .insert({ name: "Org A", slug: `org-a-${Date.now()}` })
      .select("id")
      .single()
    const { data: b } = await admin
      .from("organizations")
      .insert({ name: "Org B", slug: `org-b-${Date.now()}` })
      .select("id")
      .single()
    orgA = a!.id as string
    orgB = b!.id as string

    // two users, one in each org
    const emailA = `rls-a-${Date.now()}@test.shipos.app`
    const emailB = `rls-b-${Date.now()}@test.shipos.app`
    const { data: ua } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    })
    const { data: ub } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    })

    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: ua!.user.id, role: "owner" },
      { organization_id: orgB, user_id: ub!.user.id, role: "owner" },
    ])

    await admin
      .from("profiles")
      .update({ active_organization_id: orgA })
      .eq("id", ua!.user.id)
    await admin
      .from("profiles")
      .update({ active_organization_id: orgB })
      .eq("id", ub!.user.id)

    // seed a flag in each
    await admin.from("feature_flags").insert([
      { organization_id: orgA, key: "new_ui", name: "New UI", environment: "production" },
      { organization_id: orgB, key: "secret", name: "Secret", environment: "production" },
    ])

    // sign in both users to get fresh tokens with custom_access_token_hook claims
    const clientA = createSupabaseClient(URL!, ANON!)
    const { data: signA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    })
    const clientB = createSupabaseClient(URL!, ANON!)
    const { data: signB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    })
    userA = {
      id: ua!.user.id,
      email: emailA,
      accessToken: signA.session!.access_token,
    }
    userB = {
      id: ub!.user.id,
      email: emailB,
      accessToken: signB.session!.access_token,
    }
  })

  it("user A sees only Org A's flags", async () => {
    const client = createSupabaseClient(URL!, ANON!, {
      global: { headers: { Authorization: `Bearer ${userA.accessToken}` } },
    })
    const { data, error } = await client
      .from("feature_flags")
      .select("key, organization_id")
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    for (const row of data!) {
      expect(row.organization_id).toBe(orgA)
    }
    expect(data!.some((r) => r.key === "new_ui")).toBe(true)
    expect(data!.some((r) => r.key === "secret")).toBe(false)
  })

  it("user B cannot read Org A's flags", async () => {
    const client = createSupabaseClient(URL!, ANON!, {
      global: { headers: { Authorization: `Bearer ${userB.accessToken}` } },
    })
    const { data } = await client
      .from("feature_flags")
      .select("key, organization_id")
      .eq("organization_id", orgA)
    expect(data).toEqual([])
  })

  it("user A cannot insert a flag into Org B", async () => {
    const client = createSupabaseClient(URL!, ANON!, {
      global: { headers: { Authorization: `Bearer ${userA.accessToken}` } },
    })
    const { error } = await client
      .from("feature_flags")
      .insert({
        organization_id: orgB,
        key: "attack",
        name: "Attack",
        environment: "production",
      })
    expect(error).not.toBeNull()
  })

  it("JWT contains organization_id claim", async () => {
    const parts = userA.accessToken.split(".")
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64").toString("utf8"),
    ) as Record<string, unknown>
    expect(payload.organization_id).toBe(orgA)
  })
})

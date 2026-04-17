/**
 * Supabase Auth webhook — fires when a new auth.users row is created.
 *
 * Configure in Supabase Studio → Database → Webhooks:
 *   - Table: auth.users
 *   - Events: INSERT
 *   - Method: POST
 *   - URL: {NEXT_APP_URL}/api/auth/hooks/user-created
 *   - HTTP Headers: { "x-shipos-webhook-secret": "{SUPABASE_WEBHOOK_SECRET}" }
 *
 * This route:
 *   1. Creates a Polar customer keyed by auth.users.id (externalId).
 *   2. Inserts the mapping into `polar_customers` so the portal + webhooks
 *      can resolve organization_id later (org_id is set the first time the
 *      user joins/creates an organization).
 */
import { NextResponse } from "next/server"
import { polarClient } from "@/lib/polar"
import { createAdminClient } from "@/lib/supabase/admin"
import { createLogger } from "@/lib/logger"

const log = createLogger("auth.hooks.user-created")

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET
  if (!expected) {
    log.error("SUPABASE_WEBHOOK_SECRET not configured")
    return NextResponse.json({ error: "not_configured" }, { status: 500 })
  }

  const provided = req.headers.get("x-shipos-webhook-secret")
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const record = body?.record ?? body?.new ?? body
  const userId: string | undefined = record?.id
  const email: string | undefined = record?.email
  if (!userId || !email) {
    return NextResponse.json({ error: "missing_user_fields" }, { status: 400 })
  }

  try {
    const customer = await polarClient.customers.create({
      email,
      externalId: userId,
      name: record?.raw_user_meta_data?.name ?? email.split("@")[0],
    })

    const admin = createAdminClient()
    const { error } = await admin.from("polar_customers").upsert(
      {
        user_id: userId,
        polar_customer_id: customer.id,
        organization_id: null,
      },
      { onConflict: "user_id" },
    )
    if (error) {
      log.error({ err: error, userId }, "failed to insert polar_customers")
      return NextResponse.json({ error: "db_error" }, { status: 500 })
    }

    log.info({ userId, polarCustomerId: customer.id }, "polar customer created")
    return NextResponse.json({ ok: true, polar_customer_id: customer.id })
  } catch (err) {
    log.error({ err, userId }, "polar customer creation failed")
    return NextResponse.json({ error: "polar_create_failed" }, { status: 500 })
  }
}

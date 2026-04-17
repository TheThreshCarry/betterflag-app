"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabaseSession } from "@/lib/supabase/session"
import { getOrganizationEntitlements } from "@/lib/billing/entitlements"

export type BillingState = {
  polarCustomerId: string | null
  plan: "free" | "pro" | "team"
  status: "active" | "trialing" | "canceled" | "past_due" | "none"
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

/**
 * Resolve the current user's + active org's billing state from Supabase only.
 * No Polar round-trip — the webhook keeps `subscriptions` fresh.
 */
export async function getBillingState(): Promise<BillingState> {
  const session = await getSupabaseSession()
  const admin = createAdminClient()

  const { data: mapping } = await admin
    .from("polar_customers")
    .select("polar_customer_id")
    .eq("user_id", session.userId)
    .maybeSingle()

  if (!session.organizationId) {
    return {
      polarCustomerId: mapping?.polar_customer_id ?? null,
      plan: "free",
      status: "none",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }
  }

  const ent = await getOrganizationEntitlements(session.organizationId)
  return {
    polarCustomerId: mapping?.polar_customer_id ?? null,
    plan: ent.plan,
    status: ent.status,
    currentPeriodEnd: ent.currentPeriodEnd,
    cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
  }
}

export type BillingOrder = {
  id: string
  createdAt: string
  amount: number
  currency: string
  productName: string | null
}

export async function listBillingOrders(limit = 10): Promise<BillingOrder[]> {
  const session = await getSupabaseSession()
  if (!session.organizationId) return []
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("orders")
    .select("polar_order_id, product_id, amount, currency, paid_at, created_at, metadata")
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.polar_order_id as string,
    createdAt: (row.paid_at as string | null) ?? (row.created_at as string),
    amount: Number(row.amount ?? 0),
    currency: (row.currency as string) ?? "USD",
    productName:
      ((row.metadata as Record<string, unknown> | null)?.product_name as string | null) ??
      null,
  }))
}

/**
 * Entitlements — resolve an organization's active plan from the local
 * `subscriptions` table (populated by /api/billing/webhooks).
 *
 * Source of truth: Supabase. We no longer round-trip to Polar on every
 * request. Use `syncOrganizationEntitlements` to refresh KV after a
 * subscription change.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { PLAN_LIMITS, type PlanSlug } from "@/lib/polar/subscription"
import { createLogger } from "@/lib/logger"

const log = createLogger("entitlements")

export type Entitlements = {
  organizationId: string
  plan: PlanSlug
  limits: (typeof PLAN_LIMITS)[PlanSlug]
  status: "active" | "trialing" | "canceled" | "past_due" | "none"
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

function detectPlanSlug(productId: string | null | undefined): PlanSlug {
  if (!productId) return "free"
  if (productId === process.env.POLAR_TEAM_PRODUCT_ID) return "team"
  if (productId === process.env.POLAR_PRO_PRODUCT_ID) return "pro"
  return "pro"
}

export async function getOrganizationEntitlements(
  organizationId: string,
): Promise<Entitlements> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "product_id, status, current_period_end, cancel_at_period_end",
    )
    .eq("organization_id", organizationId)
    .in("status", ["active", "trialing"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    log.error({ err: error, organizationId }, "entitlements query failed")
  }

  const plan = detectPlanSlug(data?.product_id ?? null)
  return {
    organizationId,
    plan,
    limits: PLAN_LIMITS[plan],
    status: (data?.status as Entitlements["status"]) ?? "none",
    currentPeriodEnd: data?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
  }
}

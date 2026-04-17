/**
 * Polar webhook route — verifies signature via @polar-sh/supabase adapter,
 * then upserts subscriptions/orders into Supabase (service-role).
 *
 * Configure Polar dashboard → Webhooks → point at /api/billing/webhooks
 * with secret = POLAR_WEBHOOK_SECRET.
 */
import { Webhooks } from "@polar-sh/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrganizationEntitlements } from "@/lib/billing/entitlements"
import { syncEntitlementsTenant } from "@/lib/sync/kv-sync"
import { createLogger } from "@/lib/logger"

const log = createLogger("polar.webhooks")

async function syncEntitlementsForCustomer(polarCustomerId: string) {
  const admin = createAdminClient()
  const { data: mapping } = await admin
    .from("polar_customers")
    .select("organization_id")
    .eq("polar_customer_id", polarCustomerId)
    .maybeSingle()
  if (!mapping?.organization_id) return
  const ent = await getOrganizationEntitlements(mapping.organization_id)
  await syncEntitlementsTenant(mapping.organization_id, {
    plan: ent.plan,
    status: ent.status,
    limits: ent.limits,
    currentPeriodEnd: ent.currentPeriodEnd,
    cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
  })
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function upsertSubscriptionAndSync(sub: any) {
  await upsertSubscription(sub)
  const polarCustomerId: string | undefined =
    sub?.customer?.id ?? sub?.customerId
  if (polarCustomerId) {
    try {
      await syncEntitlementsForCustomer(polarCustomerId)
    } catch (err) {
      log.error({ err, polarCustomerId }, "entitlements KV sync failed")
    }
  }
}

async function upsertSubscription(sub: any) {
  const admin = createAdminClient()
  const polarCustomerId: string | undefined =
    sub?.customer?.id ?? sub?.customerId
  if (!polarCustomerId) {
    log.warn({ subscriptionId: sub?.id }, "subscription missing customer id")
    return
  }

  // Resolve organization_id via polar_customers mapping.
  const { data: mapping } = await admin
    .from("polar_customers")
    .select("organization_id")
    .eq("polar_customer_id", polarCustomerId)
    .maybeSingle()

  const { error } = await admin.from("subscriptions").upsert(
    {
      polar_subscription_id: sub.id,
      polar_customer_id: polarCustomerId,
      organization_id: mapping?.organization_id ?? null,
      product_id: sub.productId ?? sub.product?.id,
      status: sub.status,
      current_period_end: sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toISOString()
        : null,
      cancel_at_period_end: Boolean(sub.cancelAtPeriodEnd),
      metadata: sub.metadata ?? {},
    },
    { onConflict: "polar_subscription_id" },
  )

  if (error) {
    log.error({ err: error, subscriptionId: sub.id }, "upsert subscription failed")
    throw error
  }
}

async function upsertOrder(order: any) {
  const admin = createAdminClient()
  const polarCustomerId: string | undefined =
    order?.customer?.id ?? order?.customerId
  if (!polarCustomerId) return

  const { data: mapping } = await admin
    .from("polar_customers")
    .select("organization_id")
    .eq("polar_customer_id", polarCustomerId)
    .maybeSingle()

  await admin.from("orders").upsert(
    {
      polar_order_id: order.id,
      polar_customer_id: polarCustomerId,
      organization_id: mapping?.organization_id ?? null,
      product_id: order.productId ?? order.product?.id,
      amount: order.amount ?? 0,
      currency: order.currency ?? "USD",
      paid_at: order.paidAt ? new Date(order.paidAt).toISOString() : null,
      metadata: order.metadata ?? {},
    },
    { onConflict: "polar_order_id" },
  )
}

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onSubscriptionCreated: async (payload: any) => {
    await upsertSubscriptionAndSync(payload.data)
  },
  onSubscriptionUpdated: async (payload: any) => {
    await upsertSubscriptionAndSync(payload.data)
  },
  onSubscriptionActive: async (payload: any) => {
    await upsertSubscriptionAndSync(payload.data)
  },
  onSubscriptionCanceled: async (payload: any) => {
    await upsertSubscriptionAndSync(payload.data)
  },
  onSubscriptionRevoked: async (payload: any) => {
    await upsertSubscriptionAndSync(payload.data)
  },
  onSubscriptionUncanceled: async (payload: any) => {
    await upsertSubscriptionAndSync(payload.data)
  },
  onOrderCreated: async (payload: any) => {
    await upsertOrder(payload.data)
  },
  onOrderPaid: async (payload: any) => {
    await upsertOrder(payload.data)
  },
  onOrderRefunded: async (payload: any) => {
    await upsertOrder(payload.data)
  },
  onCustomerStateChanged: async (payload: any) => {
    log.info(
      { customerId: payload?.data?.id },
      "polar customer state changed",
    )
  },
  onPayload: async (payload: any) => {
    log.debug({ type: payload?.type }, "polar webhook received")
  },
})

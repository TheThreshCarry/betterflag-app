/**
 * Polar webhook event handlers.
 *
 * These are passed to the `webhooks()` plugin in the Better Auth
 * server configuration. Keep business logic here so `lib/auth/index.ts`
 * stays focused on auth wiring.
 */

// Types are inferred by Polar's webhook plugin, but we keep the handlers
// loosely typed here for flexibility. Polar passes the full webhook payload.

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function onCustomerStateChanged(payload: any) {
  const customerId = payload?.data?.customer?.externalId;
  console.log("[Polar Webhook] Customer state changed:", customerId);

  // Future: invalidate cached subscription state, update organization metadata,
  // or trigger real-time notification to the dashboard.
}

export async function onOrderPaid(payload: any) {
  const orderId = payload?.data?.id;
  const amount = payload?.data?.amount;
  const productName = payload?.data?.product?.name;

  console.log(
    `[Polar Webhook] Order paid: ${orderId} — ${productName} ($${((amount ?? 0) / 100).toFixed(2)})`
  );

  // Future: send a confirmation email, log to analytics, update internal records.
}

export async function onSubscriptionCreated(payload: any) {
  const subscriptionId = payload?.data?.id;
  const productName = payload?.data?.product?.name;
  const customerId = payload?.data?.customer?.externalId;

  console.log(
    `[Polar Webhook] Subscription created: ${subscriptionId} — ${productName} for customer ${customerId}`
  );

  // Future: provision paid features, send welcome email for the new plan,
  // update organization metadata with plan info.
}

export async function onSubscriptionCanceled(payload: any) {
  const subscriptionId = payload?.data?.id;
  const customerId = payload?.data?.customer?.externalId;

  console.log(
    `[Polar Webhook] Subscription canceled: ${subscriptionId} for customer ${customerId}`
  );

  // Future: send "sorry to see you go" email, schedule downgrade at period end,
  // notify organization admins.
}

export async function onSubscriptionRevoked(payload: any) {
  const subscriptionId = payload?.data?.id;
  const customerId = payload?.data?.customer?.externalId;

  console.log(
    `[Polar Webhook] Subscription revoked: ${subscriptionId} for customer ${customerId}`
  );

  // Future: immediately restrict access to paid features, downgrade to free tier,
  // notify organization admins of payment failure.
}

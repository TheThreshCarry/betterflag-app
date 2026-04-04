/**
 * Polar webhook event handlers.
 *
 * These are passed to the `webhooks()` plugin in the Better Auth
 * server configuration. Keep business logic here so `lib/auth/index.ts`
 * stays focused on auth wiring.
 */

import { createLogger } from "@/lib/logger"

const log = createLogger("polar.webhook")

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function onCustomerStateChanged(payload: any) {
  const customerId = payload?.data?.customer?.externalId;
  log.info({ customerId }, "customer state changed");
}

export async function onOrderPaid(payload: any) {
  const orderId = payload?.data?.id;
  const amount = payload?.data?.amount;
  const productName = payload?.data?.product?.name;

  log.info(
    { orderId, productName, amountCents: amount },
    "order paid"
  );
}

export async function onSubscriptionCreated(payload: any) {
  const subscriptionId = payload?.data?.id;
  const productName = payload?.data?.product?.name;
  const customerId = payload?.data?.customer?.externalId;

  log.info(
    { subscriptionId, productName, customerId },
    "subscription created"
  );
}

export async function onSubscriptionCanceled(payload: any) {
  const subscriptionId = payload?.data?.id;
  const customerId = payload?.data?.customer?.externalId;

  log.info({ subscriptionId, customerId }, "subscription canceled");
}

export async function onSubscriptionRevoked(payload: any) {
  const subscriptionId = payload?.data?.id;
  const customerId = payload?.data?.customer?.externalId;

  log.warn({ subscriptionId, customerId }, "subscription revoked");
}

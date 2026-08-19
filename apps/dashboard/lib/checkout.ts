/**
 * Polar checkout creation.
 *
 * Resolves the product for a plan from Polar (the pricing source of truth),
 * then opens a hosted checkout. The org link is carried two ways so the
 * betterflag-webhooks worker can always resolve the org from the resulting
 * subscription:
 *   - `metadata.org_id` (Polar copies checkout metadata onto the subscription)
 *   - `externalCustomerId = orgId` (sets the Polar customer's external_id)
 */
import { HttpError } from "@/lib/errors";
import { withBusinessSpan } from "@/lib/observability";
import { getPolar } from "@/lib/polar";
import type { PlanKey } from "@/lib/pricing-config";
import { getPricingTiers } from "@/lib/pricing";

export interface CheckoutRequestInput {
  orgId: string;
  productId: string;
  planKey: PlanKey;
  /** Dashboard origin, e.g. https://app.betterflag.app */
  origin: string;
  customerEmail?: string | null;
}

/** Build the Polar checkout payload (pure, unit tested). */
export function buildCheckoutRequest(input: CheckoutRequestInput) {
  return {
    products: [input.productId],
    // {CHECKOUT_ID} is substituted by Polar on redirect.
    successUrl: `${input.origin}/settings/billing?checkout=success&checkout_id={CHECKOUT_ID}`,
    externalCustomerId: input.orgId,
    metadata: { org_id: input.orgId, plan: input.planKey },
    ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
  };
}

/** Create a hosted checkout for a plan and return its URL. */
export async function createCheckoutForPlan(input: {
  orgId: string;
  planKey: PlanKey;
  origin: string;
  customerEmail?: string | null;
}): Promise<{ url: string }> {
  const tiers = await getPricingTiers();
  const tier = tiers.find((t) => t.key === input.planKey);
  if (!tier?.productId) {
    throw new HttpError(
      503,
      "billing_unconfigured",
      `Polar has no purchasable product for plan "${input.planKey}". Set POLAR_ACCESS_TOKEN (production OAT) and POLAR_SERVER=production.`,
    );
  }

  const productId = tier.productId;
  const polar = getPolar();
  const checkout = await withBusinessSpan("polar.checkout.create", () =>
    polar.checkouts.create(
      buildCheckoutRequest({
        orgId: input.orgId,
        productId,
        planKey: input.planKey,
        origin: input.origin,
        customerEmail: input.customerEmail,
      }),
    ),
  );
  return { url: checkout.url };
}

/**
 * Open the Polar customer portal for an org's subscription so the user can
 * update their card, see invoices, or cancel. The org is linked to the Polar
 * customer via `external_id = orgId` (set at checkout), so we create a session
 * by external customer id. Throws 404-ish if the org has no Polar customer yet
 * (never subscribed), which the route surfaces as a friendly message.
 */
export async function createBillingPortal(input: {
  orgId: string;
}): Promise<{ url: string }> {
  const polar = getPolar();
  try {
    const session = await withBusinessSpan("polar.portal.create", () =>
      polar.customerSessions.create({
        externalCustomerId: input.orgId,
      }),
    );
    return { url: session.customerPortalUrl };
  } catch {
    throw new HttpError(
      400,
      "no_billing_account",
      "No billing account yet. Choose a plan first to set up billing.",
    );
  }
}

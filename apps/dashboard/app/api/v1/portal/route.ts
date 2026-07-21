import { NextResponse, type NextRequest } from "next/server";

import { resolveActor } from "@/lib/auth";
import { createBillingPortal } from "@/lib/checkout";
import { HttpError, withErrors } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Open the Polar customer portal for the caller's org so the user can update
 * their payment method, view invoices, or cancel. Not billing-gated: a
 * restricted (past-due) org must be able to reach billing to recover.
 */
export const POST = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  if (actor.type !== "user") {
    throw new HttpError(403, "user_only", "Billing must be managed by a signed-in user");
  }

  const { url } = await createBillingPortal({ orgId: actor.orgId });
  return NextResponse.json({ url });
});

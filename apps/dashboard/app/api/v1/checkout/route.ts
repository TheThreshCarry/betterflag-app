import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { resolveActor, resolveSessionUser } from "@/lib/auth";
import { createCheckoutForPlan } from "@/lib/checkout";
import { HttpError, parseJson, withErrors } from "@/lib/errors";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "launch", "scale"]),
});

/**
 * Start a Polar hosted checkout for the caller's org. Intentionally NOT
 * billing-gated, a restricted (past-due) org must be able to pay to recover.
 */
export const POST = withErrors(async (request: NextRequest) => {
  const actor = await resolveActor(request);
  if (actor.type !== "user") {
    throw new HttpError(403, "user_only", "Checkout must be started by a signed-in user");
  }

  const { plan } = await parseJson(request, checkoutSchema);
  const { email } = await resolveSessionUser();
  const origin = new URL(request.url).origin;

  const { url } = await createCheckoutForPlan({
    orgId: actor.orgId,
    planKey: plan,
    origin,
    customerEmail: email,
  });

  return NextResponse.json({ url });
});

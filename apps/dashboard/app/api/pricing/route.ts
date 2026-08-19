/**
 * Public pricing endpoint, the single source both the dashboard and the
 * marketing landing page read from. Serves the Betterflag tiers as normalized JSON,
 * sourced from Polar (with a safe fallback). CORS-open so the landing site can
 * fetch it cross-origin; cached at the edge with stale-while-revalidate.
 */

import { NextResponse } from "next/server";

import { withErrors } from "@/lib/errors";
import { getPricingTiers } from "@/lib/pricing";
import { withBusinessSpan } from "@/lib/observability";

export const runtime = "nodejs";
export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const GET = withErrors(async () => {
  const tiers = await withBusinessSpan("pricing.load", () => getPricingTiers(), {
    "event.name": "pricing.load",
  });
  return NextResponse.json(
    { tiers, source: tiers[0]?.productId ? "polar" : "fallback" },
    {
      headers: {
        ...CORS,
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

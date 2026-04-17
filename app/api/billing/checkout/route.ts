/**
 * Polar Checkout route — thin wrapper around the @polar-sh/supabase adapter.
 *
 * Query params (see polar.sh/docs/integrate/sdk/adapters/supabase):
 *   ?products=<product_id|slug>
 *   &customerExternalId=<user_id>
 *   &customerEmail=<email>
 *
 * Redirects to POLAR_SUCCESS_URL after checkout.
 */
import { Checkout } from "@polar-sh/supabase"

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl:
    process.env.POLAR_SUCCESS_URL ??
    "http://localhost:3000/dashboard/settings/billing?success=true",
  server: (process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox",
})

/**
 * Polar Customer Portal route.
 *
 * Resolves the Polar customer ID for the signed-in Supabase user by
 * looking up `polar_customers` (service-role, bypasses RLS).
 */
import { CustomerPortal } from "@polar-sh/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox",
  returnUrl:
    process.env.POLAR_SUCCESS_URL ??
    "http://localhost:3000/dashboard/settings/billing",
  getCustomerId: async () => {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("unauthorized")

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("polar_customers")
      .select("polar_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error || !data?.polar_customer_id) {
      throw new Error("polar_customer_not_found")
    }
    return data.polar_customer_id
  },
})

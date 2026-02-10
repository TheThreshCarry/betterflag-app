import { DashboardLayout } from "@/components/dashboard-layout"
import { BillingClient } from "./billing-client"

export default async function BillingPage() {
  // Pass Polar product IDs to the client for plan detection
  const productIds = {
    pro: process.env.POLAR_PRO_PRODUCT_ID ?? "",
    team: process.env.POLAR_TEAM_PRODUCT_ID ?? "",
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Billing" },
      ]}
    >
      <BillingClient productIds={productIds} />
    </DashboardLayout>
  )
}

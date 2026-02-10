import { DashboardLayout } from "@/components/dashboard-layout"
import { DomainsClient } from "./domains-client"

export default async function DomainsPage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Domains" },
      ]}
    >
      <DomainsClient />
    </DashboardLayout>
  )
}

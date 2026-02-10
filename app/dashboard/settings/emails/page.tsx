import { DashboardLayout } from "@/components/dashboard-layout"
import { EmailsClient } from "./emails-client"

export default async function EmailsPage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Emails" },
      ]}
    >
      <EmailsClient />
    </DashboardLayout>
  )
}

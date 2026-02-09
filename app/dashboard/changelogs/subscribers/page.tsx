import { DashboardLayout } from "@/components/dashboard-layout"
import { SubscribersClient } from "./subscribers-client"
import { getSubscribers } from "@/lib/actions/changelog-subscriptions"

export default async function SubscribersPage() {
  const subscribers = await getSubscribers()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Changelogs", href: "/dashboard/changelogs" },
        { label: "Subscribers" },
      ]}
    >
      <SubscribersClient initialSubscribers={subscribers} />
    </DashboardLayout>
  )
}

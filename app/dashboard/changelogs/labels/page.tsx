import { DashboardLayout } from "@/components/dashboard-layout"
import { LabelsClient } from "./labels-client"
import { getChangelogLabels } from "@/lib/actions/changelog-labels"

export default async function ChangelogLabelsPage() {
  const labels = await getChangelogLabels()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Changelogs", href: "/dashboard/changelogs" },
        { label: "Labels" },
      ]}
    >
      <LabelsClient initialLabels={labels} />
    </DashboardLayout>
  )
}

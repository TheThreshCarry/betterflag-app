import { DashboardLayout } from "@/components/dashboard-layout"
import { ChangelogEditor } from "../editor/changelog-editor"
import { getChangelogLabels } from "@/lib/actions/changelog-labels"

export default async function NewChangelogPage() {
  const labels = await getChangelogLabels()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Changelogs", href: "/dashboard/changelogs" },
        { label: "New Release" },
      ]}
    >
      <ChangelogEditor labels={labels} />
    </DashboardLayout>
  )
}

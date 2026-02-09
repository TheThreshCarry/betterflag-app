import { DashboardLayout } from "@/components/dashboard-layout"
import { ChangelogsClient } from "./changelogs-client"
import { getChangelogs } from "@/lib/actions/changelogs"
import { getChangelogLabels } from "@/lib/actions/changelog-labels"

export default async function ChangelogsPage() {
  const [entries, labels] = await Promise.all([
    getChangelogs(),
    getChangelogLabels(),
  ])

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Changelogs" },
      ]}
    >
      <ChangelogsClient initialEntries={entries} labels={labels} />
    </DashboardLayout>
  )
}

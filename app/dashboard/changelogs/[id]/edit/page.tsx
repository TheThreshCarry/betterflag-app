import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ChangelogEditor } from "../../editor/changelog-editor"
import { getChangelog, getChangelogLabelAssignments } from "@/lib/actions/changelogs"
import { getChangelogLabels } from "@/lib/actions/changelog-labels"

interface EditChangelogPageProps {
  params: Promise<{ id: string }>
}

export default async function EditChangelogPage({ params }: EditChangelogPageProps) {
  const { id } = await params
  const [changelog, labels, assignments] = await Promise.all([
    getChangelog(id),
    getChangelogLabels(),
    getChangelogLabelAssignments(id),
  ])

  if (!changelog) {
    notFound()
  }

  const assignedLabelIds = assignments.map((a) => a.labelId)

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Changelogs", href: "/dashboard/changelogs" },
        { label: "Edit Release" },
      ]}
    >
      <ChangelogEditor
        changelog={changelog}
        labels={labels}
        assignedLabelIds={assignedLabelIds}
      />
    </DashboardLayout>
  )
}

import { DashboardLayout } from "@/components/dashboard-layout"
import { getContentTypes } from "@/lib/actions/content-types"
import { getEntries } from "@/lib/actions/entries"
import { CmsOverview } from "@/components/cms/cms-overview"

export default async function CmsPage() {
  const [contentTypes, allEntries] = await Promise.all([
    getContentTypes(),
    getEntries(),
  ])

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS" },
      ]}
    >
      <CmsOverview contentTypes={contentTypes} entries={allEntries} />
    </DashboardLayout>
  )
}

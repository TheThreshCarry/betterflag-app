import { DashboardLayout } from "@/components/dashboard-layout"
import { getContentTypes } from "@/lib/actions/content-types"
import { ContentTypesClient } from "@/components/cms/content-types-client"

export default async function ContentTypesPage() {
  const contentTypes = await getContentTypes()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: "Content Types" },
      ]}
    >
      <ContentTypesClient contentTypes={contentTypes} />
    </DashboardLayout>
  )
}

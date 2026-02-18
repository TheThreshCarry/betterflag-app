import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getContentType, getContentTypes } from "@/lib/actions/content-types"
import { EditSchemaClient } from "./edit-schema-client"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditSchemaPage({ params }: PageProps) {
  const { id } = await params
  const [contentType, allContentTypes] = await Promise.all([
    getContentType(id),
    getContentTypes(),
  ])

  if (!contentType) {
    notFound()
  }

  // Exclude the current content type from the relation picker list
  const otherContentTypes = allContentTypes
    .filter((ct) => ct.id !== id)
    .map((ct) => ({ id: ct.id, name: ct.name, slug: ct.slug }))

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: contentType.name, href: `/dashboard/cms/content-types/${id}` },
        { label: "Edit Schema" },
      ]}
    >
      <EditSchemaClient
        contentType={contentType}
        otherContentTypes={otherContentTypes}
      />
    </DashboardLayout>
  )
}

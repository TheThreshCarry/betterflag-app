import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getContentType } from "@/lib/actions/content-types"
import { getEntriesByContentType } from "@/lib/actions/entries"
import { ContentTypeDetail } from "@/components/cms/content-type-detail"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ContentTypeDetailPage({ params }: PageProps) {
  const { id } = await params
  const [contentType, entries] = await Promise.all([
    getContentType(id),
    getEntriesByContentType(id),
  ])

  if (!contentType) {
    notFound()
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: "Content Types", href: "/dashboard/cms/content-types" },
        { label: contentType.name },
      ]}
    >
      <ContentTypeDetail contentType={contentType} entries={entries} />
    </DashboardLayout>
  )
}

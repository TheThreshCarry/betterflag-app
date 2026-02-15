import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getContentType } from "@/lib/actions/content-types"
import { EntryEditor } from "@/components/cms/entry-editor"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function NewEntryPage({ params }: PageProps) {
  const { id } = await params
  const contentType = await getContentType(id)

  if (!contentType) {
    notFound()
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: contentType.name, href: `/dashboard/cms/content-types/${id}` },
        { label: "New Entry" },
      ]}
    >
      <EntryEditor contentType={contentType} />
    </DashboardLayout>
  )
}

import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getContentType } from "@/lib/actions/content-types"
import { getEntry } from "@/lib/actions/entries"
import { EntryEditor } from "@/components/cms/entry-editor"

interface PageProps {
  params: Promise<{ id: string; entryId: string }>
}

export default async function EditEntryPage({ params }: PageProps) {
  const { id, entryId } = await params
  const [contentType, entry] = await Promise.all([
    getContentType(id),
    getEntry(entryId),
  ])

  if (!contentType || !entry) {
    notFound()
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: contentType.name, href: `/dashboard/cms/content-types/${id}` },
        { label: "Edit Entry" },
      ]}
    >
      <EntryEditor contentType={contentType} entry={entry} />
    </DashboardLayout>
  )
}

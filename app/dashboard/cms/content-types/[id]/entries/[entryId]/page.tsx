import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{ id: string; entryId: string }>
}

export default async function EntryPage({ params }: PageProps) {
  const { id, entryId } = await params
  redirect(`/dashboard/cms/content-types/${id}/entries/${entryId}/edit`)
}

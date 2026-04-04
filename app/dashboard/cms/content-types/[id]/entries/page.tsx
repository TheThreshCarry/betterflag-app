import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EntriesIndexPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/dashboard/cms/content-types/${id}`)
}

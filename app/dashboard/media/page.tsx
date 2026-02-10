import { DashboardLayout } from "@/components/dashboard-layout"
import { MediaClient } from "./media-client"
import { getMediaAssets, getMediaFolders, getMediaStorageUsage } from "@/lib/actions/media"

export default async function MediaPage() {
  const [assets, folders, storageUsage] = await Promise.all([
    getMediaAssets("/"),
    getMediaFolders("/"),
    getMediaStorageUsage(),
  ])

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Media" },
      ]}
    >
      <MediaClient
        initialAssets={assets}
        initialFolders={folders}
        storageUsage={storageUsage}
      />
    </DashboardLayout>
  )
}

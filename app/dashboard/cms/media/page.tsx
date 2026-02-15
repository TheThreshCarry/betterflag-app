import { DashboardLayout } from "@/components/dashboard-layout"
import { getCmsMedia } from "@/lib/actions/cms-media"
import { CmsMediaClient } from "@/components/cms/cms-media-client"

export default async function CmsMediaPage() {
  const media = await getCmsMedia()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: "Media" },
      ]}
    >
      <CmsMediaClient media={media} />
    </DashboardLayout>
  )
}

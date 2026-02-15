import { DashboardLayout } from "@/components/dashboard-layout"
import { NewContentTypeWizard } from "./wizard"

export default function NewContentTypePage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: "Content Types", href: "/dashboard/cms/content-types" },
        { label: "New" },
      ]}
    >
      <NewContentTypeWizard />
    </DashboardLayout>
  )
}

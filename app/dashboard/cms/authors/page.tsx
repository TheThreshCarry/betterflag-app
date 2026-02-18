import { DashboardLayout } from "@/components/dashboard-layout"
import { AuthorsClient } from "@/components/cms/authors-client"

export default async function AuthorsPage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: "Authors" },
      ]}
    >
      <AuthorsClient />
    </DashboardLayout>
  )
}

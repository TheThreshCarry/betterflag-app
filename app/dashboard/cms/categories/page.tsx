import { DashboardLayout } from "@/components/dashboard-layout"
import { CategoriesClient } from "@/components/cms/categories-client"

export default async function CategoriesPage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "CMS", href: "/dashboard/cms" },
        { label: "Categories" },
      ]}
    >
      <CategoriesClient />
    </DashboardLayout>
  )
}

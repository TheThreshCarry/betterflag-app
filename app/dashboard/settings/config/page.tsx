import { DashboardLayout } from "@/components/dashboard-layout"
import { GlobalConfigClient } from "./global-config-client"
import { getGlobalConfigs } from "@/lib/actions/global-configs"

export default async function GlobalConfigPage() {
  const configs = await getGlobalConfigs()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Global Config" },
      ]}
    >
      <GlobalConfigClient initialConfigs={configs} />
    </DashboardLayout>
  )
}

import { DashboardLayout } from "@/components/dashboard-layout"
import { GlobalConfigClient } from "./global-config-client"
import { getGlobalConfigs } from "@/lib/actions/global-configs"

interface GlobalConfigPageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function GlobalConfigPage({ searchParams }: GlobalConfigPageProps) {
  const configs = await getGlobalConfigs()
  const params = await searchParams
  const selectedId = params.id

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Global Configs" },
      ]}
    >
      <GlobalConfigClient initialConfigs={configs} selectedId={selectedId} />
    </DashboardLayout>
  )
}

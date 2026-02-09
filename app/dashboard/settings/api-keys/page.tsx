import { DashboardLayout } from "@/components/dashboard-layout"
import { ApiKeysClient } from "./api-keys-client"
import { getApiKeys } from "@/lib/actions/api-keys"

export default async function ApiKeysPage() {
  const apiKeys = await getApiKeys()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "API Keys" },
      ]}
    >
      <ApiKeysClient initialApiKeys={apiKeys} />
    </DashboardLayout>
  )
}

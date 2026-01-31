import { DashboardLayout } from "@/components/dashboard-layout"
import { FeatureFlagsClient } from "./feature-flags-client"
import { getFeatureFlags } from "@/lib/actions/feature-flags"

export default async function FeatureFlagsPage() {
  const flags = await getFeatureFlags()

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Feature Flags" },
      ]}
    >
      <FeatureFlagsClient initialFlags={flags} />
    </DashboardLayout>
  )
}

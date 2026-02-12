import { notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getFeatureFlag } from "@/lib/actions/feature-flags"
import {
  getFlagEvaluationsTimeseries,
  getFlagSummaryStats,
  getFlagCountryBreakdown,
} from "@/lib/actions/flag-analytics"
import { FlagDetailClient } from "./flag-detail-client"

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const flag = await getFeatureFlag(id)

  if (!flag) notFound()

  // Fetch analytics data in parallel
  const [timeseries, summary, countries] = await Promise.all([
    getFlagEvaluationsTimeseries(flag.key),
    getFlagSummaryStats(flag.key),
    getFlagCountryBreakdown(flag.key),
  ])

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Feature Flags", href: "/dashboard/flags" },
        { label: flag.name },
      ]}
    >
      <FlagDetailClient
        flag={flag}
        timeseries={timeseries}
        summary={summary}
        countries={countries}
      />
    </DashboardLayout>
  )
}

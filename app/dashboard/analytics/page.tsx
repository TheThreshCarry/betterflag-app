import { DashboardLayout } from "@/components/dashboard-layout"
import { BarChart3 } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Analytics" },
      ]}
    >
      <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">Analytics</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Track page views, events, and user behavior across your application.
          Gain insights with detailed dashboards and reports. This module is
          currently under development.
        </p>
        <div className="mt-4 inline-flex items-center rounded-full border bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
          Coming Soon
        </div>
      </div>
    </DashboardLayout>
  )
}

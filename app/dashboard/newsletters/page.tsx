import { DashboardLayout } from "@/components/dashboard-layout"
import { Mail } from "lucide-react"

export default function NewslettersPage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Newsletters" },
      ]}
    >
      <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Mail className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">Newsletters</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Send beautiful newsletters to your subscribers, manage campaigns, and
          track engagement. This module is currently under development.
        </p>
        <div className="mt-4 inline-flex items-center rounded-full border bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
          Coming Soon
        </div>
      </div>
    </DashboardLayout>
  )
}

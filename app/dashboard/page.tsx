import { headers } from "next/headers"
import { DashboardLayout } from "@/components/dashboard-layout"
import { auth } from "@/lib/auth"

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  // Get active organization if available
  const activeOrgId = session?.session.activeOrganizationId
  let organization = null

  if (activeOrgId) {
    organization = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: activeOrgId },
    })
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Overview" },
      ]}
    >
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">
          Welcome back, {session?.user.name}!
        </h2>
        <p className="text-muted-foreground mt-1">
          {session?.user.email}
        </p>
        {organization && (
          <p className="text-muted-foreground mt-1">
            Organization: {organization.name}
          </p>
        )}
      </div>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
    </DashboardLayout>
  )
}

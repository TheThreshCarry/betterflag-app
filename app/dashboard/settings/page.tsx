import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { GeneralSettingsClient } from "./general-settings-client"

export default async function GeneralSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/auth/login")
  }

  // DashboardLayout guarantees an active org, but we need the data for the form
  const activeOrgId = session.session.activeOrganizationId
  let organization = null

  if (activeOrgId) {
    organization = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: activeOrgId },
    })
  }

  // Parse description from metadata
  let description = ""
  if (organization?.metadata) {
    try {
      const meta =
        typeof organization.metadata === "string"
          ? JSON.parse(organization.metadata)
          : organization.metadata
      description = meta?.description ?? ""
    } catch {
      // ignore parse errors
    }
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "General" },
      ]}
    >
      <GeneralSettingsClient
        organization={
          organization
            ? {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                logo: organization.logo,
                description,
                createdAt: organization.createdAt.toISOString(),
              }
            : null
        }
      />
    </DashboardLayout>
  )
}

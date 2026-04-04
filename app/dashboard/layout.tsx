import { CommandK } from "@/components/command-k"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { getGlobalConfigs } from "@/lib/actions/global-configs"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/auth/login")
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    avatar: session.user.image || "",
  }

  // Get active organization if available
  const activeOrgId = session.session.activeOrganizationId
  let organization = null

  if (activeOrgId) {
    organization = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: activeOrgId },
    })
  }

  // If no active org, check if user has any orgs at all
  if (!organization) {
    const orgs = await auth.api.listOrganizations({
      headers: await headers(),
    })

    if (!orgs || orgs.length === 0) {
      // No orgs at all — redirect to onboarding
      redirect("/onboarding")
    }

    // Has orgs but none active — set the first one as active
    await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId: orgs[0].id },
    })
    organization = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: orgs[0].id },
    })
  }

  // Fetch global configs for dynamic sidebar
  const configs = await getGlobalConfigs()
  const simplifiedConfigs = configs.map((config) => ({
    id: config.id,
    slug: config.slug,
    name: config.name,
    environment: config.environment,
  }))

  return (
    <>
      <SidebarProvider>
        <AppSidebar user={user} organization={organization} configs={simplifiedConfigs} />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
      <CommandK />
    </>
  )
}

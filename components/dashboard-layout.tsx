import React from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { getGlobalConfigs } from "@/lib/actions/global-configs"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
  breadcrumbs: BreadcrumbItem[]
}

export async function DashboardLayout({ children, breadcrumbs }: DashboardLayoutProps) {
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
    <SidebarProvider>
      <AppSidebar user={user} organization={organization} configs={simplifiedConfigs} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                    <BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
                      {item.href ? (
                        <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

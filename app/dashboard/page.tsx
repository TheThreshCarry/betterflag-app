import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
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

export default async function Page() {
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

  return (
    <SidebarProvider>
      <AppSidebar user={user} organization={organization} />
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
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Overview</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">
              Welcome back, {session.user.name}!
            </h2>
            <p className="text-muted-foreground mt-1">
              {session.user.email}
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

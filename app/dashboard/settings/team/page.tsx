import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TeamClient } from "./team-client"

export default async function TeamPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/auth/login")
  }

  const activeOrgId = session.session.activeOrganizationId
  let organization = null
  let members: Array<{
    id: string
    userId: string
    role: string
    createdAt: string
    user: { id: string; name: string; email: string; image: string | null }
  }> = []
  let invitations: Array<{
    id: string
    email: string
    role: string | null
    status: string
    expiresAt: string
    inviterId: string
  }> = []

  if (activeOrgId) {
    const fullOrg = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: activeOrgId },
    })

    if (fullOrg) {
      organization = {
        id: fullOrg.id,
        name: fullOrg.name,
        slug: fullOrg.slug,
      }

      members = (fullOrg.members ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        userId: m.userId as string,
        role: m.role as string,
        createdAt:
          m.createdAt instanceof Date
            ? m.createdAt.toISOString()
            : String(m.createdAt),
        user: m.user as {
          id: string
          name: string
          email: string
          image: string | null
        },
      }))

      invitations = (fullOrg.invitations ?? []).map(
        (inv: Record<string, unknown>) => ({
          id: inv.id as string,
          email: inv.email as string,
          role: inv.role as string | null,
          status: inv.status as string,
          expiresAt:
            inv.expiresAt instanceof Date
              ? inv.expiresAt.toISOString()
              : String(inv.expiresAt),
          inviterId: inv.inviterId as string,
        })
      )
    }
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Team" },
      ]}
    >
      <TeamClient
        organization={organization}
        initialMembers={members}
        initialInvitations={invitations.filter((i) => i.status === "pending")}
        currentUserId={session.user.id}
      />
    </DashboardLayout>
  )
}

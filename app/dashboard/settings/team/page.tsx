import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseSession } from "@/lib/supabase/session"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TeamClient } from "./team-client"

type MemberRole = "owner" | "admin" | "member"

export default async function TeamPage() {
  let session
  try {
    session = await getSupabaseSession()
  } catch {
    redirect("/auth/login")
  }

  const supabase = await createClient()

  let organization: { id: string; name: string; slug: string } | null = null
  let members: Array<{
    id: string
    userId: string
    role: MemberRole
    createdAt: string
    user: { id: string; name: string; email: string; image: string | null }
  }> = []
  let invitations: Array<{
    id: string
    email: string
    role: MemberRole | null
    status: string
    expiresAt: string
    inviterId: string
  }> = []

  if (session.organizationId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", session.organizationId)
      .maybeSingle()
    organization = org ?? null

    const { data: memberRows } = await supabase
      .from("organization_members")
      .select(
        "id, user_id, role, created_at, profiles:user_id ( id, name, email, image )",
      )
      .eq("organization_id", session.organizationId)

    members = ((memberRows ?? []) as Array<Record<string, unknown>>).map((m) => {
      const rawProfile = m.profiles as
        | { id: string; name: string | null; email: string; image: string | null }
        | Array<{ id: string; name: string | null; email: string; image: string | null }>
        | null
      const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
      return {
        id: m.id as string,
        userId: m.user_id as string,
        role: m.role as MemberRole,
        createdAt: m.created_at as string,
        user: {
          id: profile?.id ?? (m.user_id as string),
          name: profile?.name ?? "",
          email: profile?.email ?? "",
          image: profile?.image ?? null,
        },
      }
    })

    const { data: inviteRows } = await supabase
      .from("invitations")
      .select("id, email, role, status, expires_at, inviter_id")
      .eq("organization_id", session.organizationId)
      .eq("status", "pending")

    invitations = (inviteRows ?? []).map((inv) => ({
      id: inv.id as string,
      email: inv.email as string,
      role: inv.role as MemberRole | null,
      status: inv.status as string,
      expiresAt: inv.expires_at as string,
      inviterId: inv.inviter_id as string,
    }))
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
        initialInvitations={invitations}
        currentUserId={session.userId}
      />
    </DashboardLayout>
  )
}

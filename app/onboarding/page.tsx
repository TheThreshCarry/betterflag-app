import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabaseSession } from "@/lib/supabase/session"
import { OnboardingWizard } from "./onboarding-wizard"

export default async function OnboardingPage() {
  let session
  try {
    session = await getSupabaseSession()
  } catch {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, active_organization_id")
    .eq("id", session.userId)
    .maybeSingle()

  const userName = profile?.name ?? session.email.split("@")[0] ?? ""

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name, slug, metadata)")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: true })

  if (memberships && memberships.length > 0) {
    const activeOrgId =
      session.organizationId ?? profile?.active_organization_id ?? memberships[0].organization_id
    const active = memberships.find(
      (m) => m.organization_id === activeOrgId,
    ) ?? memberships[0]

    const org = Array.isArray(active.organizations)
      ? active.organizations[0]
      : (active.organizations as { id: string; metadata: Record<string, unknown> | null } | null)
    const metadata = (org?.metadata ?? {}) as Record<string, unknown>

    if (metadata.onboardingCompleted === true) {
      if (!session.organizationId && org?.id) {
        const admin = createAdminClient()
        await admin
          .from("profiles")
          .update({ active_organization_id: org.id })
          .eq("id", session.userId)
      }
      redirect("/dashboard")
    }

    if (!session.organizationId && org?.id) {
      const admin = createAdminClient()
      await admin
        .from("profiles")
        .update({ active_organization_id: org.id })
        .eq("id", session.userId)
    }

    return (
      <OnboardingWizard
        userName={userName}
        initialStep="pick-product"
        organizationId={active.organization_id}
      />
    )
  }

  return <OnboardingWizard userName={userName} initialStep="create-org" />
}

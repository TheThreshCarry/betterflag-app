import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { OnboardingWizard } from "./onboarding-wizard"

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/auth/login")
  }

  // Check if the user already has organizations
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  })

  if (orgs && orgs.length > 0) {
    // Parse org metadata to check onboarding status
    const activeOrgId =
      session.session.activeOrganizationId || orgs[0].id
    const activeOrg = orgs.find((o) => o.id === activeOrgId) || orgs[0]

    let metadata: Record<string, unknown> = {}
    try {
      metadata = JSON.parse(activeOrg.metadata || "{}")
    } catch {
      metadata = {}
    }

    // If onboarding is completed, go to dashboard
    if (metadata.onboardingCompleted === true) {
      // Set active org if not already
      if (!session.session.activeOrganizationId) {
        await auth.api.setActiveOrganization({
          headers: await headers(),
          body: { organizationId: activeOrg.id },
        })
      }
      redirect("/dashboard")
    }

    // Onboarding NOT completed — set org active and resume at module selection
    if (!session.session.activeOrganizationId) {
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: activeOrg.id },
      })
    }

    return (
      <OnboardingWizard
        userName={session.user.name}
        initialStep="select-modules"
        organizationId={activeOrg.id}
      />
    )
  }

  // No orgs — start from the beginning
  return (
    <OnboardingWizard userName={session.user.name} initialStep="create-org" />
  )
}

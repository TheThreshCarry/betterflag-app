import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { GalleryVerticalEnd } from "lucide-react"
import Link from "next/link"
import { OnboardingForm } from "./onboarding-form"

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

  // If user already has an org, redirect to dashboard
  if (orgs && orgs.length > 0) {
    // Set the first org as active if none is active
    if (!session.session.activeOrganizationId) {
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: orgs[0].id },
      })
    }
    redirect("/dashboard")
  }

  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          ShipOS
        </Link>
        <OnboardingForm userName={session.user.name} />
      </div>
    </main>
  )
}

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProfileClient } from "./profile-client"

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/auth/login")
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Profile" },
      ]}
    >
      <ProfileClient
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          emailVerified: session.user.emailVerified,
          username: (session.user as Record<string, unknown>).username as string | null ?? null,
        }}
      />
    </DashboardLayout>
  )
}

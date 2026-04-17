import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProfileClient } from "./profile-client"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, username, image")
    .eq("id", user.id)
    .maybeSingle()

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
          name: profile?.name ?? "",
          email: profile?.email ?? user.email ?? "",
          image: profile?.image ?? null,
          emailVerified: Boolean(user.email_confirmed_at),
          username: profile?.username ?? null,
        }}
      />
    </DashboardLayout>
  )
}

import { DashboardLayout } from "@/components/dashboard-layout"
import { getSupabaseSession } from "@/lib/supabase/session"
import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  let session
  try {
    session = await getSupabaseSession()
  } catch {
    session = null
  }

  let organization: { id: string; name: string } | null = null
  if (session?.organizationId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", session.organizationId)
      .maybeSingle()
    organization = data ?? null
  }

  const userName = session?.email?.split("@")[0] ?? "there"
  const userEmail = session?.email ?? ""

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Overview" },
      ]}
    >
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Welcome back, {userName}!</h2>
        <p className="text-muted-foreground mt-1">{userEmail}</p>
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
    </DashboardLayout>
  )
}

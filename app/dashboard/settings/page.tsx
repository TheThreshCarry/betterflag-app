import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseSession } from "@/lib/supabase/session"
import { DashboardLayout } from "@/components/dashboard-layout"
import { GeneralSettingsClient } from "./general-settings-client"

export default async function GeneralSettingsPage() {
  let session
  try {
    session = await getSupabaseSession()
  } catch {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  let organization: {
    id: string
    name: string
    slug: string
    logo: string | null
    metadata: Record<string, unknown> | null
    created_at: string
  } | null = null

  if (session.organizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug, logo, metadata, created_at")
      .eq("id", session.organizationId)
      .maybeSingle()
    organization = data ?? null
  }

  let description = ""
  if (organization?.metadata) {
    const meta =
      typeof organization.metadata === "string"
        ? (() => {
            try {
              return JSON.parse(organization!.metadata as unknown as string)
            } catch {
              return {}
            }
          })()
        : organization.metadata
    description = (meta as Record<string, unknown>)?.description as string ?? ""
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "General" },
      ]}
    >
      <GeneralSettingsClient
        organization={
          organization
            ? {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                logo: organization.logo,
                description,
                createdAt: organization.created_at,
              }
            : null
        }
      />
    </DashboardLayout>
  )
}

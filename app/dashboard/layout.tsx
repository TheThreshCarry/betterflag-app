import { CommandK } from "@/components/command-k"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseSession } from "@/lib/supabase/session"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbarContent } from "@/components/app-topbar"
import { getGlobalConfigs } from "@/lib/actions/global-configs"
import {
  AppShell,
  AppMain,
  AppContent,
} from "@/components/patterns/app-shell"
import posthogServer from "@/lib/posthog"
import { Providers } from "@/app/providers"

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let session
  try {
    session = await getSupabaseSession()
  } catch {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  const { data: profile } = (await supabase
    .from("profiles")
    .select("name, email, image")
    .eq("id", session.userId)
    .maybeSingle()) as {
    data: { name: string | null; email: string; image: string | null } | null
  }

  const user = {
    name: profile?.name ?? session.email.split("@")[0] ?? "",
    email: profile?.email ?? session.email,
    avatar: profile?.image ?? "",
  }

  if (!session.organizationId) {
    redirect("/onboarding")
  }

  const { data: organization } = (await supabase
    .from("organizations")
    .select("id, name, slug, logo, metadata")
    .eq("id", session.organizationId)
    .maybeSingle()) as {
    data: {
      id: string
      name: string
      slug: string
      logo: string | null
      metadata: Record<string, unknown> | null
    } | null
  }

  if (!organization) {
    redirect("/onboarding")
  }

  const allFlags = posthogServer
    ? await posthogServer.getAllFlags(session.userId, {
        groups: { organization: organization.id },
        personProperties: {
          email: user.email,
          name: user.name,
        },
        groupProperties: {
          organization: {
            name: organization.name,
            slug: organization.slug,
          },
        },
      })
    : {}

  const bootstrapData = {
    userId: session.userId,
    userName: user.name,
    userEmail: user.email,
    activeOrgId: organization.id,
    activeOrgName: organization.name,
    activeOrgSlug: organization.slug,
    featureFlags: allFlags as Record<string, string | boolean>,
  }

  const configs = (await getGlobalConfigs()) as Array<{
    id: string
    slug: string
    name: string
    environment: string
  }>
  const simplifiedConfigs = configs.map((config) => ({
    id: config.id,
    slug: config.slug,
    name: config.name,
    environment: config.environment,
  }))

  return (
    <Providers bootstrapData={bootstrapData}>
      <AppShell>
        <AppTopbarContent user={user} organization={organization} />
        <AppMain columns="sidebar">
          <AppSidebar
            user={user}
            organization={organization}
            configs={simplifiedConfigs}
          />
          <AppContent>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </AppContent>
        </AppMain>
      </AppShell>
      <CommandK />
    </Providers>
  )
}

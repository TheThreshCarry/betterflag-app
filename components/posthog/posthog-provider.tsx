"use client"

import posthog from "posthog-js"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, Suspense } from "react"

function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      const qs = searchParams?.toString()
      if (qs) url += "?" + qs
      posthog.capture("$pageview", { $current_url: url })
    }
  }, [pathname, searchParams])

  return null
}

export type BootstrapData = {
  userId: string
  userName: string
  userEmail: string
  activeOrgId: string | null
  activeOrgName: string | null
  activeOrgSlug: string | null
  featureFlags?: Record<string, string | boolean>
}

export function PostHogProvider({
  bootstrapData,
  children,
}: {
  bootstrapData: BootstrapData | null
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!bootstrapData) return

    posthog.identify(bootstrapData.userId, {
      name: bootstrapData.userName,
      email: bootstrapData.userEmail,
    })

    if (bootstrapData.activeOrgId) {
      posthog.group("organization", bootstrapData.activeOrgId, {
        name: bootstrapData.activeOrgName,
        slug: bootstrapData.activeOrgSlug,
      })
    }

    if (bootstrapData.featureFlags) {
      posthog.featureFlags.override(bootstrapData.featureFlags)
    }
  }, [bootstrapData])

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </>
  )
}

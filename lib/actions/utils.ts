"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/**
 * Get the active organization ID for the current user.
 *
 * If no org is active but the user belongs to at least one org,
 * the first org is automatically set as active.
 *
 * This prevents the race condition where server actions run before
 * DashboardLayout has had a chance to set the active org.
 */
export async function getOrganizationId(): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) return null

  // If there's already an active org, use it
  if (session.session.activeOrganizationId) {
    return session.session.activeOrganizationId
  }

  // No active org — try to find and activate the user's first org
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  })

  if (orgs && orgs.length > 0) {
    await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId: orgs[0].id },
    })
    return orgs[0].id
  }

  return null
}

/**
 * Get the active organization ID and current user ID.
 */
export async function getSessionData(): Promise<{
  organizationId: string | null
  userId: string | null
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) return { organizationId: null, userId: null }

  let orgId = session.session.activeOrganizationId

  if (!orgId) {
    const orgs = await auth.api.listOrganizations({
      headers: await headers(),
    })

    if (orgs && orgs.length > 0) {
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: orgs[0].id },
      })
      orgId = orgs[0].id
    }
  }

  return {
    organizationId: orgId || null,
    userId: session.user.id || null,
  }
}

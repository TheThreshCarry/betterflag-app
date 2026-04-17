"use server"

import posthogServer from "@/lib/posthog"

export async function checkAlphaAccess(email: string): Promise<boolean> {
  if (!posthogServer) return false
  const flag = await posthogServer.getFeatureFlag("alpha-access", email, {
    personProperties: { email },
  })
  return flag === true || flag === "true"
}

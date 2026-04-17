"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabaseSession } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { captureProductEvent, ProductEvent } from "@/lib/analytics/product-events"

export async function updateProfile(input: {
  name?: string
  username?: string
  image?: string | null
}) {
  const session = await getSupabaseSession()
  const log = createActionLogger("actions.profile", session)
  const supabase = await createClient()

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (typeof input.name === "string") patch.name = input.name
  if (typeof input.username === "string") {
    patch.username = input.username || null
  }
  if (input.image !== undefined) patch.image = input.image

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", session.userId)

  if (error) {
    log.error({ err: error }, "profile update failed")
    throw new Error(error.message)
  }

  if (input.name) {
    try {
      await supabase.auth.updateUser({
        data: { name: input.name },
      })
    } catch (err) {
      log.warn({ err }, "auth.updateUser metadata sync failed")
    }
  }

  captureProductEvent(ProductEvent.PROFILE_UPDATED, session, {
    updated_name: input.name !== undefined,
    updated_username: input.username !== undefined,
    updated_image: input.image !== undefined,
  })
  revalidatePath("/dashboard/settings/profile")
}

/**
 * Switch the user's active organization. Writes `profiles.active_organization_id`
 * so the custom_access_token_hook picks it up on next JWT refresh.
 */
export async function setActiveOrganization(organizationId: string) {
  const session = await getSupabaseSession()
  const supabase = await createClient()

  const admin = createAdminClient()
  const { error } = await admin
    .from("profiles")
    .update({ active_organization_id: organizationId })
    .eq("id", session.userId)

  if (error) throw new Error(error.message)

  try {
    await supabase.auth.refreshSession()
  } catch {
    // refresh fails in RSC boundary sometimes; middleware will refresh on next request.
  }

  captureProductEvent(ProductEvent.ACTIVE_ORGANIZATION_SWITCHED, session, {
    new_organization_id: organizationId,
    previous_organization_id: session.organizationId,
  })
  revalidatePath("/dashboard")
}

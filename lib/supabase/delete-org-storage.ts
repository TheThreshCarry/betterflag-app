import type { SupabaseClient } from "@supabase/supabase-js"
import { createLogger } from "@/lib/logger"

const log = createLogger("supabase.delete-org-storage")

const ORG_LOGOS_BUCKET = "org-logos"

/**
 * Deletes all objects under `org-logos/{organizationId}/` (org logo uploads).
 * Safe to call when the prefix is empty or the bucket is missing locally.
 */
export async function deleteOrgLogoStorage(
  admin: SupabaseClient,
  organizationId: string
): Promise<void> {
  const prefix = organizationId

  const { data: objects, error } = await admin.storage
    .from(ORG_LOGOS_BUCKET)
    .list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    })

  if (error) {
    log.warn(
      { err: error, organizationId },
      "org-logos list failed (bucket may be absent in dev)"
    )
    return
  }

  if (!objects?.length) return

  const paths = objects.map((o) => `${prefix}/${o.name}`)
  const { error: removeErr } = await admin.storage
    .from(ORG_LOGOS_BUCKET)
    .remove(paths)

  if (removeErr) {
    log.error({ err: removeErr, organizationId }, "org-logos remove failed")
    throw new Error(removeErr.message)
  }
}

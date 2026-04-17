import posthog from "@/lib/posthog"
import type { SupabaseSessionData } from "@/lib/supabase/session"

/** Stable names for dashboard product analytics (snake_case). */
export const ProductEvent = {
  ORGANIZATION_CREATED: "organization_created",
  ORGANIZATION_UPDATED: "organization_updated",
  ORGANIZATION_DELETED: "organization_deleted",
  ORGANIZATION_INVITE_SENT: "organization_invite_sent",
  INVITATION_ACCEPTED: "invitation_accepted",
  FEATURE_FLAG_CREATED: "feature_flag_created",
  FEATURE_FLAG_UPDATED: "feature_flag_updated",
  FEATURE_FLAG_DELETED: "feature_flag_deleted",
  PROFILE_UPDATED: "profile_updated",
  ACTIVE_ORGANIZATION_SWITCHED: "active_organization_switched",
  CONTENT_TYPE_CREATED: "content_type_created",
  CONTENT_TYPE_UPDATED: "content_type_updated",
  CONTENT_TYPE_DELETED: "content_type_deleted",
  CONTENT_TYPE_STATUS_CHANGED: "content_type_status_changed",
  CONTENT_TYPE_SCHEMA_UPDATED: "content_type_schema_updated",
  CMS_ENTRY_CREATED: "cms_entry_created",
  CMS_ENTRY_UPDATED: "cms_entry_updated",
  CMS_ENTRY_DELETED: "cms_entry_deleted",
  CMS_ENTRIES_BULK_DELETED: "cms_entries_bulk_deleted",
  CMS_ENTRY_PUBLISHED: "cms_entry_published",
  CMS_ENTRY_UNPUBLISHED: "cms_entry_unpublished",
  CHANGELOG_CREATED: "changelog_created",
  CHANGELOG_UPDATED: "changelog_updated",
  CHANGELOG_DELETED: "changelog_deleted",
  GLOBAL_CONFIG_CREATED: "global_config_created",
  GLOBAL_CONFIG_UPDATED: "global_config_updated",
  GLOBAL_CONFIG_DELETED: "global_config_deleted",
  API_KEY_CREATED: "api_key_created",
  API_KEY_DELETED: "api_key_deleted",
  API_KEY_TOGGLED: "api_key_toggled",
  CUSTOMER_CREATED: "customer_created",
  CUSTOMER_UPDATED: "customer_updated",
  CUSTOMER_DELETED: "customer_deleted",
  MEDIA_ASSET_DELETED: "media_asset_deleted",
} as const

/**
 * Server-side PostHog capture. Uses same distinct_id and organization group as the web SDK.
 * Never throws — failures should not block mutations.
 */
export function captureProductEvent(
  event: string,
  session: SupabaseSessionData | null,
  properties?: Record<string, unknown>,
): void {
  if (!posthog || !session) return
  try {
    posthog.capture({
      distinctId: session.userId,
      event,
      properties: {
        organization_id: session.organizationId ?? undefined,
        organization_role: session.organizationRole,
        is_super_admin: session.isSuperAdmin,
        ...properties,
      },
      ...(session.organizationId
        ? { groups: { organization: session.organizationId } }
        : {}),
    })
  } catch {
    // ignore analytics failures
  }
}

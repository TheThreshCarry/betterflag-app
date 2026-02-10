"use server"

import { eq, ilike, or, and, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { featureFlags, changelogs, globalConfigs, customers } from "@/lib/db/schema"
import { getOrganizationId } from "@/lib/actions/utils"

export type SearchResult = {
  id: string
  title: string
  description?: string | null
  type: "feature-flag" | "changelog" | "global-config" | "customer"
  url: string
  meta?: Record<string, string>
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const organizationId = await getOrganizationId()
  const searchPattern = `%${query.trim()}%`

  const orgCondition = (orgField: typeof featureFlags.organizationId) =>
    organizationId ? eq(orgField, organizationId) : isNull(orgField)

  // Run all searches in parallel
  const [flagResults, changelogResults, configResults, customerResults] = await Promise.all([
    // Search feature flags
    db.query.featureFlags.findMany({
      where: and(
        orgCondition(featureFlags.organizationId),
        or(
          ilike(featureFlags.key, searchPattern),
          ilike(featureFlags.name, searchPattern)
        )
      ),
      limit: 5,
    }),

    // Search changelogs
    db.query.changelogs.findMany({
      where: and(
        orgCondition(changelogs.organizationId),
        or(
          ilike(changelogs.title, searchPattern),
          ilike(changelogs.slug, searchPattern)
        )
      ),
      limit: 5,
    }),

    // Search global configs
    db.query.globalConfigs.findMany({
      where: and(
        orgCondition(globalConfigs.organizationId),
        or(
          ilike(globalConfigs.name, searchPattern),
          ilike(globalConfigs.slug, searchPattern)
        )
      ),
      limit: 5,
    }),

    // Search customers
    db.query.customers.findMany({
      where: and(
        orgCondition(customers.organizationId),
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.email, searchPattern),
          ilike(customers.externalId, searchPattern)
        )
      ),
      limit: 5,
    }),
  ])

  const results: SearchResult[] = []

  for (const flag of flagResults) {
    results.push({
      id: flag.id,
      title: flag.name,
      description: flag.key,
      type: "feature-flag",
      url: `/dashboard/flags`,
      meta: {
        environment: flag.environment,
        enabled: flag.enabled ? "enabled" : "disabled",
      },
    })
  }

  for (const cl of changelogResults) {
    results.push({
      id: cl.id,
      title: cl.title,
      description: cl.version || cl.status,
      type: "changelog",
      url: `/dashboard/changelogs/${cl.id}/edit`,
      meta: {
        status: cl.status,
      },
    })
  }

  for (const config of configResults) {
    results.push({
      id: config.id,
      title: config.name,
      description: config.slug,
      type: "global-config",
      url: `/dashboard/configs`,
      meta: {
        environment: config.environment,
      },
    })
  }

  for (const customer of customerResults) {
    results.push({
      id: customer.id,
      title: customer.name || customer.email || "Unnamed Customer",
      description: customer.email || customer.externalId || undefined,
      type: "customer",
      url: `/dashboard/customers`,
    })
  }

  return results
}

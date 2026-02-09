"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { eq, and, isNull, desc } from "drizzle-orm"
import db from "@/lib/db"
import {
  changelogSubscriptions,
  customers,
  type NewChangelogSubscription,
} from "@/lib/db/schema"
import { auth } from "@/lib/auth"

async function getOrganizationId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session?.session.activeOrganizationId || null
}

export async function getSubscribers() {
  const organizationId = await getOrganizationId()

  // Get active subscriptions (not unsubscribed) with customer data
  const orgFilter = organizationId
    ? eq(changelogSubscriptions.organizationId, organizationId)
    : isNull(changelogSubscriptions.organizationId)

  const subscriptions = await db.query.changelogSubscriptions.findMany({
    where: and(
      orgFilter,
      isNull(changelogSubscriptions.unsubscribedAt)
    ),
    orderBy: [desc(changelogSubscriptions.subscribedAt)],
  })

  // Fetch associated customer data
  const subscribersWithCustomers = await Promise.all(
    subscriptions.map(async (sub) => {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, sub.customerId),
      })
      return {
        ...sub,
        customer,
      }
    })
  )

  return subscribersWithCustomers
}

export async function subscribe(customerId: string) {
  const organizationId = await getOrganizationId()

  // Check if already subscribed (and not unsubscribed)
  const orgFilter = organizationId
    ? eq(changelogSubscriptions.organizationId, organizationId)
    : isNull(changelogSubscriptions.organizationId)

  const existing = await db.query.changelogSubscriptions.findFirst({
    where: and(
      eq(changelogSubscriptions.customerId, customerId),
      orgFilter,
      isNull(changelogSubscriptions.unsubscribedAt)
    ),
  })

  if (existing) {
    return existing
  }

  const [subscription] = await db
    .insert(changelogSubscriptions)
    .values({
      customerId,
      organizationId,
    })
    .returning()

  revalidatePath("/dashboard/changelogs/subscribers")
  return subscription
}

export async function unsubscribe(subscriptionId: string) {
  const [subscription] = await db
    .update(changelogSubscriptions)
    .set({
      unsubscribedAt: new Date(),
    })
    .where(eq(changelogSubscriptions.id, subscriptionId))
    .returning()

  revalidatePath("/dashboard/changelogs/subscribers")
  return subscription
}

export async function addSubscriber(data: {
  email: string
  name?: string
}) {
  const organizationId = await getOrganizationId()

  // Create customer first
  const [customer] = await db
    .insert(customers)
    .values({
      email: data.email,
      name: data.name || null,
      organizationId,
    })
    .returning()

  // Then subscribe them
  const [subscription] = await db
    .insert(changelogSubscriptions)
    .values({
      customerId: customer.id,
      organizationId,
    })
    .returning()

  revalidatePath("/dashboard/changelogs/subscribers")
  return { customer, subscription }
}

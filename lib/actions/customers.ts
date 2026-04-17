"use server"

import { revalidatePath } from "next/cache"
import { eq, and, desc, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { customers, type NewCustomer } from "@/lib/db/schema"
import { getOrganizationId } from "@/lib/actions/utils"
import { getSupabaseSessionOptional } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { createLogger } from "@/lib/logger"
import { captureProductEvent, ProductEvent } from "@/lib/analytics/product-events"

export async function getCustomers() {
  const organizationId = await getOrganizationId()

  return db.query.customers.findMany({
    where: organizationId
      ? eq(customers.organizationId, organizationId)
      : isNull(customers.organizationId),
    orderBy: [desc(customers.createdAt)],
  })
}

export async function getCustomer(id: string) {
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  return db.query.customers.findFirst({
    where: and(eq(customers.id, id), eq(customers.organizationId, organizationId)),
  })
}

export async function createCustomer(
  data: Omit<NewCustomer, "id" | "createdAt" | "updatedAt" | "organizationId">
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.customers", session) : createLogger("actions.customers")
  const organizationId = await getOrganizationId()

  const [customer] = await db
    .insert(customers)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  log.info({ id: customer.id, orgId: organizationId }, "customer created")
  captureProductEvent(ProductEvent.CUSTOMER_CREATED, session, {
    customer_id: customer.id,
  })
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/changelogs/subscribers")
  return customer
}

export async function updateCustomer(
  id: string,
  data: Partial<Omit<NewCustomer, "id" | "createdAt" | "organizationId">>
) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.customers", session) : createLogger("actions.customers")
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const [customer] = await db
    .update(customers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
    .returning()

  log.info({ id }, "customer updated")
  captureProductEvent(ProductEvent.CUSTOMER_UPDATED, session, {
    customer_id: id,
  })
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/changelogs/subscribers")
  return customer
}

export async function deleteCustomer(id: string) {
  const session = await getSupabaseSessionOptional()
  const log = session ? createActionLogger("actions.customers", session) : createLogger("actions.customers")
  const organizationId = await getOrganizationId()
  if (!organizationId) throw new Error("No active organization")
  const existing = await db.query.customers.findFirst({
    where: and(eq(customers.id, id), eq(customers.organizationId, organizationId)),
  })
  if (!existing) throw new Error("Customer not found")
  await db.delete(customers).where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
  log.info({ id }, "customer deleted")
  captureProductEvent(ProductEvent.CUSTOMER_DELETED, session, { customer_id: id })
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/changelogs/subscribers")
}

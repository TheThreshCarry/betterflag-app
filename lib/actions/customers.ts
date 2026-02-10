"use server"

import { revalidatePath } from "next/cache"
import { eq, desc, isNull } from "drizzle-orm"
import db from "@/lib/db"
import { customers, type NewCustomer } from "@/lib/db/schema"
import { getOrganizationId } from "@/lib/actions/utils"

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
  return db.query.customers.findFirst({
    where: eq(customers.id, id),
  })
}

export async function createCustomer(
  data: Omit<NewCustomer, "id" | "createdAt" | "updatedAt" | "organizationId">
) {
  const organizationId = await getOrganizationId()

  const [customer] = await db
    .insert(customers)
    .values({
      ...data,
      organizationId,
    })
    .returning()

  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/changelogs/subscribers")
  return customer
}

export async function updateCustomer(
  id: string,
  data: Partial<Omit<NewCustomer, "id" | "createdAt" | "organizationId">>
) {
  const [customer] = await db
    .update(customers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning()

  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/changelogs/subscribers")
  return customer
}

export async function deleteCustomer(id: string) {
  await db.delete(customers).where(eq(customers.id, id))
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/changelogs/subscribers")
}

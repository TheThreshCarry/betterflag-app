"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabaseSession } from "@/lib/supabase/session"
import { createActionLogger } from "@/lib/log-context"
import { captureProductEvent, ProductEvent } from "@/lib/analytics/product-events"
import { deleteOrgLogoStorage } from "@/lib/supabase/delete-org-storage"
import { sendVerificationEmail } from "@/lib/email"

type MemberRole = "owner" | "admin" | "member"

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function createOrganization(input: {
  name: string
  slug?: string
  logo?: string | null
  metadata?: Record<string, unknown>
}) {
  const session = await getSupabaseSession()
  const log = createActionLogger("actions.organizations", session)
  const admin = createAdminClient()

  const slug = slugify(input.slug ?? input.name)
  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      name: input.name,
      slug,
      logo: input.logo ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id, name, slug, logo, metadata")
    .single()

  if (error || !org) {
    log.error({ err: error }, "create organization failed")
    throw new Error(error?.message ?? "Failed to create organization")
  }

  const { error: memberErr } = await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: session.userId,
    role: "owner" as MemberRole,
  })
  if (memberErr) throw new Error(memberErr.message)

  await admin
    .from("profiles")
    .update({ active_organization_id: org.id })
    .eq("id", session.userId)

  captureProductEvent(ProductEvent.ORGANIZATION_CREATED, session, {
    organization_id: org.id,
    name: org.name,
    slug: org.slug,
  })
  revalidatePath("/dashboard")
  return org
}

export async function updateOrganization(input: {
  organizationId: string
  name?: string
  logo?: string | null
  metadata?: Record<string, unknown> | string
}) {
  const session = await getSupabaseSession()
  const log = createActionLogger("actions.organizations", session)
  const admin = createAdminClient()

  const { data: membership, error: memErr } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", input.organizationId)
    .eq("user_id", session.userId)
    .maybeSingle()

  if (memErr) {
    log.error({ err: memErr }, "update org: membership lookup failed")
    throw new Error(memErr.message)
  }
  if (!membership && !session.isSuperAdmin) {
    throw new Error("Not a member of this organization")
  }
  if (
    !session.isSuperAdmin &&
    membership &&
    !["owner", "admin"].includes(membership.role)
  ) {
    throw new Error("You do not have permission to update this organization")
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.logo !== undefined) patch.logo = input.logo

  if (input.metadata !== undefined) {
    const incoming =
      typeof input.metadata === "string"
        ? (() => {
            try {
              return JSON.parse(input.metadata) as Record<string, unknown>
            } catch {
              return {}
            }
          })()
        : input.metadata

    const { data: row } = await admin
      .from("organizations")
      .select("metadata")
      .eq("id", input.organizationId)
      .maybeSingle()

    const prev =
      row?.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {}

    patch.metadata = { ...prev, ...incoming }
  }

  const { data: updated, error } = await admin
    .from("organizations")
    .update(patch)
    .eq("id", input.organizationId)
    .select("id")
    .maybeSingle()

  if (error) {
    log.error({ err: error, organizationId: input.organizationId }, "update organization failed")
    throw new Error(error.message)
  }
  if (!updated) {
    throw new Error("Organization not found or could not be updated")
  }

  captureProductEvent(ProductEvent.ORGANIZATION_UPDATED, session, {
    target_organization_id: input.organizationId,
    updated_name: input.name !== undefined,
    updated_logo: input.logo !== undefined,
    updated_metadata: input.metadata !== undefined,
  })
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/onboarding")
}

export async function deleteOrganization(organizationId: string) {
  const session = await getSupabaseSession()
  const log = createActionLogger("actions.organizations", session)
  const admin = createAdminClient()

  const { data: membership, error: memErr } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", session.userId)
    .maybeSingle()

  if (memErr) {
    log.error({ err: memErr }, "delete org: membership lookup failed")
    throw new Error(memErr.message)
  }
  const allowed =
    membership?.role === "owner" || session.isSuperAdmin
  if (!allowed) {
    throw new Error("Only the organization owner can delete it")
  }

  await deleteOrgLogoStorage(admin, organizationId)

  const { error } = await admin
    .from("organizations")
    .delete()
    .eq("id", organizationId)

  if (error) {
    log.error({ err: error, organizationId }, "delete organization failed")
    throw new Error(error.message)
  }

  log.info({ organizationId }, "organization deleted")
  captureProductEvent(ProductEvent.ORGANIZATION_DELETED, session, {
    deleted_organization_id: organizationId,
  })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings")
  revalidatePath("/onboarding")
}

export async function inviteMember(input: {
  organizationId: string
  email: string
  role: MemberRole
}) {
  const session = await getSupabaseSession()
  const log = createActionLogger("actions.organizations", session)
  const admin = createAdminClient()

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: invite, error } = await admin
    .from("invitations")
    .insert({
      organization_id: input.organizationId,
      email: input.email,
      role: input.role,
      inviter_id: session.userId,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (error || !invite) {
    log.error({ err: error }, "invite insert failed")
    throw new Error(error?.message ?? "Failed to create invitation")
  }

  try {
    const base = process.env.NEXT_APP_URL ?? "http://localhost:3000"
    const url = `${base}/auth/accept-invite?token=${invite.id}`
    await sendVerificationEmail({ email: input.email, url, type: "email-verification" })
  } catch (err) {
    log.warn({ err, inviteId: invite.id }, "invite email failed")
  }

  captureProductEvent(ProductEvent.ORGANIZATION_INVITE_SENT, session, {
    target_organization_id: input.organizationId,
    invitee_email_domain: input.email.split("@")[1] ?? "",
    role: input.role,
  })
  revalidatePath("/dashboard/settings/team")
  return invite
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/settings/team")
}

export async function updateMemberRole(input: {
  memberId: string
  role: MemberRole
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("organization_members")
    .update({ role: input.role })
    .eq("id", input.memberId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/settings/team")
}

export async function removeMember(memberId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/settings/team")
}

// ---------------------------------------------------------------------------
// Invitation acceptance: redeem an invite token, create membership.
// Called from /auth/accept-invite flow.
// ---------------------------------------------------------------------------

export async function acceptInvitation(invitationId: string) {
  const session = await getSupabaseSession()
  const admin = createAdminClient()

  const { data: inv, error } = await admin
    .from("invitations")
    .select("id, organization_id, email, role, status, expires_at")
    .eq("id", invitationId)
    .maybeSingle()

  if (error || !inv) throw new Error("Invitation not found")
  if (inv.status !== "pending") throw new Error("Invitation already used")
  if (new Date(inv.expires_at) < new Date()) throw new Error("Invitation expired")

  if (session.email.toLowerCase() !== (inv.email as string).toLowerCase()) {
    throw new Error("Invitation is for a different email")
  }

  const { error: memberErr } = await admin.from("organization_members").upsert(
    {
      id: randomUUID(),
      organization_id: inv.organization_id,
      user_id: session.userId,
      role: inv.role,
    },
    { onConflict: "organization_id,user_id" },
  )
  if (memberErr) throw new Error(memberErr.message)

  await admin
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", inv.id)

  await admin
    .from("profiles")
    .update({ active_organization_id: inv.organization_id })
    .eq("id", session.userId)

  captureProductEvent(ProductEvent.INVITATION_ACCEPTED, session, {
    joined_organization_id: inv.organization_id,
    role: inv.role,
  })
  revalidatePath("/dashboard")
  return { organizationId: inv.organization_id as string }
}

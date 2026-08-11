/**
 * Super-admin gate. Any Betterflag team member listed in BETTERFLAG_ADMIN_EMAILS
 * (comma-separated) may use this app. Everyone else gets an access-denied
 * page even with a valid Supabase session. Every server action calls
 * requireAdmin() again: the layout check is UX, this one is the boundary.
 */

import { requiredEnv } from "./env";
import { createSessionClient } from "./supabase/server";

export interface AdminIdentity {
  id: string;
  email: string;
}

export function adminEmails(): Set<string> {
  return new Set(
    requiredEnv("BETTERFLAG_ADMIN_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.toLowerCase());
}

/** The signed-in team member, or null when not signed in / not on the list. */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}

/** Throw unless the caller is a signed-in super admin. Use in server actions. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await currentAdmin();
  if (!admin) {
    throw new Error("Not authorized: this action requires a Betterflag super admin.");
  }
  return admin;
}

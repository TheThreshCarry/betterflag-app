"use server";

/**
 * Server actions behind the MCP OAuth consent screen. Approval mints the
 * per-connection agent key(s) and reports the decision to the MCP worker, which
 * completes the OAuth grant and hands back the client redirect URL.
 */
import { redirect } from "next/navigation";

import { resolveSessionUser } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
import { HttpError } from "@/lib/errors";
import {
  isValidTxnId,
  listConsentOrgs,
  mintOauthAgentKey,
  postConsentDecision,
} from "@/lib/mcp-oauth";
import { createServiceClient } from "@/lib/supabase/server";

function consentUrl(txnId: string, error: string): string {
  return `/mcp/consent?txn=${encodeURIComponent(txnId)}&error=${encodeURIComponent(error)}`;
}

export async function approveConsent(formData: FormData): Promise<void> {
  const txnId = String(formData.get("txnId") ?? "");
  const orgIds = formData.getAll("orgId").map(String).filter(Boolean);
  if (!isValidTxnId(txnId)) redirect("/mcp/consent?error=bad_txn");

  const { userId } = await resolveSessionUser();
  const memberships = await listConsentOrgs(userId);
  const selected = memberships.filter((org) => orgIds.includes(org.id));
  if (selected.length === 0) redirect(consentUrl(txnId, "bad_org"));

  const service = createServiceClient();
  const writable = [];
  for (const org of selected) {
    try {
      await assertOrgWritable(service, org.id);
      writable.push(org);
    } catch (error) {
      if (error instanceof HttpError && (error.code === "org_frozen" || error.code === "billing_restricted")) {
        continue;
      }
      throw error;
    }
  }
  if (writable.length === 0) redirect(consentUrl(txnId, "writable"));

  const clientName = formData.get("clientName");
  const label = typeof clientName === "string" && clientName ? clientName : null;

  const keys = [];
  for (const org of writable) {
    const key = await mintOauthAgentKey({
      orgId: org.id,
      userId,
      clientName: label,
    });
    keys.push({
      orgId: org.id,
      orgName: org.name,
      apiKey: key.plaintext,
      keyPrefix: key.prefix,
    });
  }

  const primary = keys[0]!;
  let result: { redirectTo: string } | null;
  try {
    result = await postConsentDecision({
      txnId,
      approve: true,
      userId,
      orgId: primary.orgId,
      orgName: primary.orgName,
      apiKey: primary.apiKey,
      keyPrefix: primary.keyPrefix,
      keys,
    });
  } catch {
    redirect(consentUrl(txnId, "failed"));
  }
  if (!result) redirect(consentUrl(txnId, "expired"));
  redirect(result.redirectTo);
}

export async function denyConsent(formData: FormData): Promise<void> {
  const txnId = String(formData.get("txnId") ?? "");
  if (!isValidTxnId(txnId)) redirect("/mcp/consent?error=bad_txn");

  await resolveSessionUser(); // still requires a session, no anonymous denials

  const result = await postConsentDecision({ txnId, approve: false });
  if (!result) redirect(consentUrl(txnId, "expired"));

  redirect(result.redirectTo);
}

"use server";

/**
 * Server actions behind the MCP OAuth consent screen. Approval mints the
 * per-connection agent key and reports the decision to the MCP worker, which
 * completes the OAuth grant and hands back the client redirect URL.
 */
import { redirect } from "next/navigation";

import { resolveSessionUser } from "@/lib/auth";
import { assertOrgWritable } from "@/lib/billing-guard";
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
  const orgId = String(formData.get("orgId") ?? "");
  if (!isValidTxnId(txnId)) redirect("/mcp/consent?error=bad_txn");

  const { userId } = await resolveSessionUser();

  // The org must be one the user actually belongs to, never trust the form.
  const orgs = await listConsentOrgs(userId);
  const org = orgs.find((candidate) => candidate.id === orgId);
  if (!org) redirect(consentUrl(txnId, "bad_org"));

  // Suspended/cancelled orgs cannot grant new access.
  await assertOrgWritable(createServiceClient(), org.id);

  const clientName = formData.get("clientName");
  const key = await mintOauthAgentKey({
    orgId: org.id,
    userId,
    clientName: typeof clientName === "string" && clientName ? clientName : null,
  });

  const result = await postConsentDecision({
    txnId,
    approve: true,
    userId,
    orgId: org.id,
    orgName: org.name,
    apiKey: key.plaintext,
    keyPrefix: key.prefix,
  });
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

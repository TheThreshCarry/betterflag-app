/**
 * Server-side glue for the MCP OAuth consent flow.
 *
 * The MCP worker (mcp.betterflag.app) runs the OAuth authorization server via
 * @cloudflare/workers-oauth-provider; the dashboard owns the human part -
 * the consent screen at /mcp/consent where a signed-in user picks which org
 * the connection may access. These helpers talk to the worker's
 * shared-secret-authenticated /internal/oauth/* endpoints and mint the
 * per-connection agent key (api_keys.source = 'oauth', exempt from plan
 * agent-key limits) that rides inside the grant.
 */
import { formatApiKey, keyPrefixOf, sha256Hex } from "@betterflag/core";
import type { ApiKeyRow, OrgPlan, OrgRole } from "@betterflag/db";

import { recordAudit } from "@/lib/db";
import { optionalEnv, requiredEnv } from "@/lib/env";
import { unwrap } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

const TXN_ID_RE = /^[0-9a-f]{48}$/;

export interface ConsentTxnDetails {
  txnId: string;
  client: {
    clientId: string;
    clientName: string | null;
    clientUri: string | null;
    logoUri: string | null;
    redirectUri: string;
  };
  scope: string[];
  createdAt: string;
}

export interface ConsentOrg {
  id: string;
  name: string;
  plan: OrgPlan;
  role: OrgRole;
}

function mcpBaseUrl(): string {
  return (optionalEnv("BETTERFLAG_MCP_URL") ?? "https://mcp.betterflag.app").replace(/\/+$/, "");
}

function sharedSecretHeaders(): HeadersInit {
  return {
    authorization: `Bearer ${requiredEnv("MCP_OAUTH_SHARED_SECRET")}`,
    "content-type": "application/json",
  };
}

export function isValidTxnId(txnId: string | undefined): txnId is string {
  return typeof txnId === "string" && TXN_ID_RE.test(txnId);
}

/** Look up what to render on the consent screen. Null → unknown/expired txn. */
export async function fetchConsentTxn(txnId: string): Promise<ConsentTxnDetails | null> {
  const res = await fetch(`${mcpBaseUrl()}/internal/oauth/txn/${txnId}`, {
    headers: sharedSecretHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MCP worker txn lookup failed (${res.status})`);
  return (await res.json()) as ConsentTxnDetails;
}

/** Report the user's decision; returns the client redirect URL for the browser. */
export async function postConsentDecision(body: {
  txnId: string;
  approve: boolean;
  userId?: string;
  orgId?: string;
  orgName?: string;
  apiKey?: string;
  keyPrefix?: string;
  keys?: Array<{ orgId: string; orgName: string; apiKey: string; keyPrefix: string }>;
}): Promise<{ redirectTo: string } | null> {
  const res = await fetch(`${mcpBaseUrl()}/internal/oauth/decision`, {
    method: "POST",
    headers: sharedSecretHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 404) return null; // expired / already-consumed txn
  if (!res.ok) throw new Error(`MCP worker decision failed (${res.status})`);
  return (await res.json()) as { redirectTo: string };
}

/** Orgs the user may connect an MCP client to (any role can consent for now). */
export async function listConsentOrgs(userId: string): Promise<ConsentOrg[]> {
  const service = createServiceClient();
  const rows = unwrap(
    await service
      .from("org_members")
      .select("role, created_at, orgs(id, name, plan)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ) as unknown as Array<{ role: OrgRole; orgs: { id: string; name: string; plan: OrgPlan } }>;

  return rows
    .filter((row) => row.orgs)
    .map((row) => ({ id: row.orgs.id, name: row.orgs.name, plan: row.orgs.plan, role: row.role }));
}

function randomHex40(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Mint the per-connection agent key an approved OAuth grant will use.
 * source='oauth' keeps it out of the plan agent-key count; it shows on the
 * Keys page and revoking it disconnects the client.
 */
export async function mintOauthAgentKey(input: {
  orgId: string;
  userId: string;
  clientName: string | null;
}): Promise<{ plaintext: string; prefix: string; name: string }> {
  const service = createServiceClient();
  const plaintext = formatApiKey("agent", randomHex40());
  const prefix = keyPrefixOf(plaintext);
  const hash = await sha256Hex(plaintext);
  const name = `${input.clientName?.trim() || "MCP client"} (OAuth connection)`.slice(0, 120);

  unwrap(
    await service
      .from("api_keys")
      .insert({
        org_id: input.orgId,
        kind: "agent",
        name,
        hash,
        prefix,
        source: "oauth",
        created_by: input.userId,
      })
      .select("id")
      .single(),
  ) as Pick<ApiKeyRow, "id">;

  await recordAudit(service, {
    orgId: input.orgId,
    actor: { actorType: "user", actorId: input.userId, actorKeyPrefix: null },
    action: "key.create",
    subject: `key:${prefix}`,
    after: { kind: "agent", name, prefix, source: "oauth" },
  });

  return { plaintext, prefix, name };
}

/**
 * OAuth authorization flow for the Betterflag MCP server.
 *
 * This module is the OAuthProvider `defaultHandler`: it owns every route the
 * provider does not (the provider itself serves /token, /register and the
 * /.well-known metadata). The flow:
 *
 *   1. Claude (or any MCP client) hits GET /authorize after dynamic client
 *      registration. We parse the request, park it in OAUTH_KV under a
 *      one-time transaction id, and redirect the browser to the dashboard
 *      consent screen (BETTERFLAG_DASHBOARD_URL/mcp/consent?txn=…) where the
 *      Supabase session lives.
 *   2. The dashboard fetches txn details server-to-server
 *      (GET /internal/oauth/txn/:id) authenticated by MCP_OAUTH_SHARED_SECRET.
 *   3. The user picks an org and approves. The dashboard mints a
 *      per-connection bf_agt_ key (source 'oauth') and posts the decision
 *      (POST /internal/oauth/decision). We complete the authorization -
 *      the key rides inside the grant props, encrypted by the provider -
 *      and hand back the client redirect URL for the browser.
 *
 * The plaintext agent key travels only over the server-to-server call and
 * inside encrypted grant props; it never appears in a browser URL or a log.
 */
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { API_KEY_RE, timingSafeEqualHex } from "@betterflag/core";
import { ICON_PNG, ICON_SVG } from "./icon";
import type { Env } from "./types";

export const CONSENT_PATH = "/mcp/consent";
export const SCOPE_MANAGE = "betterflag:manage";

/** Consent transactions expire after 10 minutes. */
const TXN_TTL_SECONDS = 600;
const TXN_PREFIX = "consent_txn:";

interface ConsentTxn {
  oauthReqInfo: AuthRequest;
  client: {
    clientId: string;
    clientName: string | null;
    clientUri: string | null;
    logoUri: string | null;
    redirectUri: string;
  };
  createdAt: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function oauthError(status: number, code: string, message: string): Response {
  return json(status, { error: { code, message } });
}

function randomTxnId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time check of the shared secret on /internal/oauth/* calls. */
function internalAuthorized(request: Request, env: Env): boolean {
  const secret = env.MCP_OAUTH_SHARED_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) return false;
  const presented = match[1].trim();
  // timingSafeEqualHex compares arbitrary equal-length strings char-by-char.
  return presented.length === secret.length && timingSafeEqualHex(presented, secret);
}

function provider(env: Env): OAuthHelpers {
  const helpers = env.OAUTH_PROVIDER;
  if (!helpers) throw new Error("OAUTH_PROVIDER missing, handler not wrapped by OAuthProvider");
  return helpers;
}

/**
 * GET /authorize, entry point of the browser flow. Parses and validates the
 * OAuth request, stores it under a one-time txn id, redirects to the
 * dashboard consent screen.
 */
async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const oauth = provider(env);

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = await oauth.parseAuthRequest(request);
  } catch (err) {
    return oauthError(400, "invalid_request", err instanceof Error ? err.message : "Malformed authorization request");
  }

  const client = await oauth.lookupClient(oauthReqInfo.clientId);
  if (!client) {
    return oauthError(400, "invalid_client", "Unknown client_id, register via dynamic client registration first.");
  }
  if (!client.redirectUris.includes(oauthReqInfo.redirectUri)) {
    // Never redirect to an unregistered URI, respond in place.
    return oauthError(400, "invalid_request", "redirect_uri is not registered for this client.");
  }

  const txn: ConsentTxn = {
    oauthReqInfo,
    client: {
      clientId: client.clientId,
      clientName: client.clientName ?? null,
      clientUri: client.clientUri ?? null,
      logoUri: client.logoUri ?? null,
      redirectUri: oauthReqInfo.redirectUri,
    },
    createdAt: new Date().toISOString(),
  };

  const txnId = randomTxnId();
  await env.OAUTH_KV.put(`${TXN_PREFIX}${txnId}`, JSON.stringify(txn), {
    expirationTtl: TXN_TTL_SECONDS,
  });

  const consent = new URL(CONSENT_PATH, env.BETTERFLAG_DASHBOARD_URL);
  consent.searchParams.set("txn", txnId);
  return Response.redirect(consent.toString(), 302);
}

/**
 * GET /internal/oauth/txn/:id, dashboard fetches what to render on the
 * consent screen. Shared-secret authenticated; returns no secrets.
 */
async function handleTxnLookup(txnId: string, env: Env): Promise<Response> {
  const raw = await env.OAUTH_KV.get(`${TXN_PREFIX}${txnId}`);
  if (!raw) {
    return oauthError(404, "txn_not_found", "Unknown or expired consent transaction. Restart the connection from your MCP client.");
  }
  const txn = JSON.parse(raw) as ConsentTxn;
  return json(200, {
    txnId,
    client: txn.client,
    scope: txn.oauthReqInfo.scope.length > 0 ? txn.oauthReqInfo.scope : [SCOPE_MANAGE],
    createdAt: txn.createdAt,
  });
}

interface DecisionBody {
  txnId: string;
  approve: boolean;
  /** Required when approve=true. */
  userId?: string;
  orgId?: string;
  orgName?: string;
  /** The per-connection bf_agt_ key minted by the dashboard. */
  apiKey?: string;
  keyPrefix?: string;
}

/**
 * POST /internal/oauth/decision, dashboard reports the user's choice.
 * On approval we complete the grant (props carry the minted agent key);
 * either way the txn is consumed and the client redirect URL is returned.
 */
async function handleDecision(request: Request, env: Env): Promise<Response> {
  let body: DecisionBody;
  try {
    body = (await request.json()) as DecisionBody;
  } catch {
    return oauthError(400, "invalid_json", "Body must be JSON");
  }
  if (!body.txnId) return oauthError(400, "invalid_request", "txnId is required");

  const kvKey = `${TXN_PREFIX}${body.txnId}`;
  const raw = await env.OAUTH_KV.get(kvKey);
  if (!raw) {
    return oauthError(404, "txn_not_found", "Unknown or expired consent transaction.");
  }
  const txn = JSON.parse(raw) as ConsentTxn;
  // One-time use: consume the txn before completing, so a replay cannot
  // mint a second grant even if this request is retried.
  await env.OAUTH_KV.delete(kvKey);

  if (!body.approve) {
    const denied = new URL(txn.oauthReqInfo.redirectUri);
    denied.searchParams.set("error", "access_denied");
    denied.searchParams.set("error_description", "The user denied the request.");
    if (txn.oauthReqInfo.state) denied.searchParams.set("state", txn.oauthReqInfo.state);
    return json(200, { redirectTo: denied.toString() });
  }

  if (!body.userId || !body.orgId || !body.apiKey || !API_KEY_RE.test(body.apiKey)) {
    return oauthError(400, "invalid_request", "Approval requires userId, orgId and a valid apiKey");
  }

  const { redirectTo } = await provider(env).completeAuthorization({
    request: txn.oauthReqInfo,
    userId: body.userId,
    scope: [SCOPE_MANAGE],
    // Safe-to-display bookkeeping (grant listing / audit); never the key.
    metadata: {
      orgId: body.orgId,
      orgName: body.orgName ?? null,
      keyPrefix: body.keyPrefix ?? null,
      clientId: txn.client.clientId,
      clientName: txn.client.clientName,
    },
    // Encrypted by the provider; surfaces as ctx.props on /mcp requests.
    props: {
      apiKey: body.apiKey,
      orgId: body.orgId,
      keyPrefix: body.keyPrefix,
      via: "oauth" as const,
    },
  });

  return json(200, { redirectTo });
}

/** OAuthProvider defaultHandler, everything that isn't /mcp, /sse or a provider endpoint. */
export const oauthDefaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/" || pathname === "/health") {
      return json(200, {
        name: "betterflag-mcp",
        status: "ok",
        transport: { streamableHttp: "/mcp", sse: "/sse" },
        oauth: { authorize: "/authorize", token: "/token", register: "/register" },
        docs: "https://betterflag.app/docs/mcp",
      });
    }

    // Connector icon: Claude fetches /favicon.ico from the server origin.
    if (pathname === "/favicon.ico" || pathname === "/favicon.png" || pathname === "/icon.png") {
      return new Response(ICON_PNG as BodyInit, {
        headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
      });
    }
    if (pathname === "/favicon.svg" || pathname === "/icon.svg" || pathname === "/logo.svg") {
      return new Response(ICON_SVG, {
        headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
      });
    }

    if (pathname === "/authorize" && request.method === "GET") {
      return handleAuthorize(request, env);
    }

    if (pathname.startsWith("/internal/oauth/")) {
      if (!internalAuthorized(request, env)) {
        return oauthError(401, "unauthorized", "Missing or invalid shared secret");
      }
      const txnMatch = /^\/internal\/oauth\/txn\/([0-9a-f]{48})$/.exec(pathname);
      if (txnMatch?.[1] && request.method === "GET") {
        return handleTxnLookup(txnMatch[1], env);
      }
      if (pathname === "/internal/oauth/decision" && request.method === "POST") {
        return handleDecision(request, env);
      }
      return oauthError(404, "not_found", "Unknown internal endpoint");
    }

    return oauthError(404, "not_found", "Unknown path. MCP lives at /mcp (or /sse for legacy clients).");
  },
};

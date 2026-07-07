/**
 * ShipOS MCP server, Cloudflare Worker entry (mcp.shipos.app).
 *
 * Two ways in, one session shape:
 *
 *  - OAuth (primary, "Connect" in Claude): @cloudflare/workers-oauth-provider
 *    wraps /mcp and /sse. It serves dynamic client registration (/register),
 *    the token endpoint (/token), and the /.well-known metadata; /authorize
 *    hands off to the dashboard consent screen (see oauth.ts) where the user
 *    picks an org. The approved grant's props carry a per-connection
 *    sos_agt_ key minted at consent, decrypted onto ctx.props per request.
 *
 *  - Legacy direct bearer: `Authorization: Bearer sos_agt_*` (admin
 *    sos_adm_* also accepted) still works for hand-configured clients. The
 *    key is format-checked here, the control plane verifies it on every
 *    wrapped REST call, and travels via ctx.props. Never logged.
 *
 * Either way the McpAgent session reads props.apiKey and proxies the
 * control plane; tools are auth-model agnostic.
 */
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { API_KEY_RE, kindOfKey } from "@shipos/core";
import { formatRelease, readObservability } from "@shipos/observability";
import { ShipOSMcp } from "./agent";
import { VERSION } from "./version.gen";
import { oauthDefaultHandler, SCOPE_MANAGE } from "./oauth";
import type { Env, SessionProps } from "./types";

export { ShipOSMcp };

const mcpHandler = ShipOSMcp.serve("/mcp", { binding: "MCP_OBJECT" });
const sseHandler = ShipOSMcp.serveSSE("/sse", { binding: "MCP_OBJECT" });

const KEY_HINT =
  "Send `Authorization: Bearer sos_agt_…`, create an agent key in the ShipOS dashboard under Keys, or connect via OAuth.";

function json(status: number, body: unknown, request?: Request): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (status === 401 && request) {
    // Point OAuth-capable clients (Claude) at the protected-resource
    // metadata served by workers-oauth-provider so they can start the flow.
    const origin = new URL(request.url).origin;
    headers["www-authenticate"] =
      `Bearer realm="ShipOS MCP", resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function unauthorized(message: string, request: Request): Response {
  return json(401, { error: { code: "unauthorized", message: `${message} ${KEY_HINT}` } }, request);
}

/**
 * Format-check a directly presented ShipOS key. Returns null when the bearer
 * is not a ShipOS key at all (then the OAuth provider validates it as a
 * token), a Response for ShipOS-key-shaped-but-invalid credentials, or the
 * accepted key.
 */
function checkDirectKey(request: Request): { apiKey: string } | Response | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || !match[1]) return null;

  const key = match[1].trim();
  if (!key.startsWith("sos_")) return null; // OAuth access token, not ours to judge.

  if (!API_KEY_RE.test(key)) {
    return unauthorized("That does not look like a ShipOS API key.", request);
  }
  const kind = kindOfKey(key);
  if (kind === "sdk") {
    return unauthorized(
      "SDK keys (sos_sdk_*) only work against the edge evaluation API, not the MCP server.",
      request,
    );
  }
  if (kind !== "agent" && kind !== "admin") {
    return unauthorized("Unsupported key type.", request);
  }
  return { apiKey: key };
}

const oauthProvider = new OAuthProvider({
  apiHandlers: {
    "/mcp": mcpHandler as never,
    "/sse": sseHandler as never,
  },
  defaultHandler: oauthDefaultHandler as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: [SCOPE_MANAGE],
});

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    const isMcp = pathname === "/mcp";
    const isSse = pathname === "/sse" || pathname === "/sse/message";

    // Legacy path: a ShipOS key presented directly skips the OAuth provider.
    if (isMcp || isSse) {
      const direct = checkDirectKey(request);
      if (direct instanceof Response || direct) {
        const obs = readObservability(env as unknown as Record<string, unknown>, "shipos-mcp", {
          environment: env.SHIPOS_ENV,
          release: formatRelease({ version: VERSION, gitSha: env.SHIPOS_GIT_SHA, override: env.SHIPOS_RELEASE }),
        });
        const log = obs.logger.child({ path: pathname, method: request.method });

        if (direct instanceof Response) {
          // The rejected key itself is never logged, only that auth failed.
          log.warn("mcp: direct key rejected at the gate", {
            status: 401,
            transport: isSse ? "sse" : "mcp",
          });
          obs.flushTo(ctx.waitUntil.bind(ctx));
          return direct;
        }

        // key_kind (agent/admin) is safe to log; the key value is not.
        log.info("mcp: session authorized (direct key)", {
          key_kind: kindOfKey(direct.apiKey),
          transport: isSse ? "sse" : "mcp",
        });
        obs.flushTo(ctx.waitUntil.bind(ctx));

        // ExecutionContext.props is typed readonly in workers-types but is
        // the documented handoff channel for the agents SDK, cast here only.
        const props: SessionProps = { apiKey: direct.apiKey, via: "bearer" };
        (ctx as unknown as { props: SessionProps }).props = props;
        return isSse ? sseHandler.fetch(request, env, ctx) : mcpHandler.fetch(request, env, ctx);
      }
      // No ShipOS key → fall through: the provider validates OAuth tokens
      // and emits the RFC-9728 401 challenge for anonymous requests.
    }

    return oauthProvider.fetch(request, env as never, ctx);
  },
} satisfies ExportedHandler<Env>;

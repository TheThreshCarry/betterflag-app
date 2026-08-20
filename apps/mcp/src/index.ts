/**
 * Betterflag MCP server, Cloudflare Worker entry (mcp.betterflag.app).
 *
 * Two ways in, one session shape:
 *
 *  - OAuth (primary, "Connect" in Claude): @cloudflare/workers-oauth-provider
 *    wraps /mcp and /sse. It serves dynamic client registration (/register),
 *    the token endpoint (/token), and the /.well-known metadata; /authorize
 *    hands off to the dashboard consent screen (see oauth.ts) where the user
 *    picks an org. The approved grant's props carry a per-connection
 *    bf_agt_ key minted at consent, decrypted onto ctx.props per request.
 *
 *  - Legacy direct bearer: `Authorization: Bearer bf_agt_*` (admin
 *    bf_adm_* also accepted) still works for hand-configured clients. The
 *    key is format-checked here, the control plane verifies it on every
 *    wrapped REST call, and travels via ctx.props. Never logged.
 *
 * Either way the McpAgent session reads props.apiKey and proxies the
 * control plane; tools are auth-model agnostic.
 */
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { API_KEY_RE, kindOfKey } from "@betterflag/core";
import {
  attachWorkerTracing,
  eventOutcomeFromStatus,
  formatRelease,
  readObservability,
  routeTemplate,
} from "@betterflag/observability";
import { BetterFlagMcp } from "./agent";
import { VERSION } from "./version.gen";
import { oauthDefaultHandler, SCOPE_MANAGE } from "./oauth";
import type { Env, SessionProps } from "./types";

export { BetterFlagMcp };

const mcpHandler = BetterFlagMcp.serve("/mcp", { binding: "MCP_OBJECT" });
const sseHandler = BetterFlagMcp.serveSSE("/sse", { binding: "MCP_OBJECT" });

const KEY_HINT =
  "Send `Authorization: Bearer bf_agt_…`, create an agent key in the Betterflag dashboard under Keys, or connect via OAuth.";

/** Browser MCP Inspector (direct Streamable HTTP) must CORS-preflight /mcp without a Bearer. */
const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id, MCP-Protocol-Version, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

function withMcpCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(status: number, body: unknown, request?: Request): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (status === 401 && request) {
    // Point OAuth-capable clients (Claude) at the protected-resource
    // metadata served by workers-oauth-provider so they can start the flow.
    const origin = new URL(request.url).origin;
    headers["www-authenticate"] =
      `Bearer realm="Betterflag MCP", resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function unauthorized(message: string, request: Request): Response {
  return json(401, { error: { code: "unauthorized", message: `${message} ${KEY_HINT}` } }, request);
}

/**
 * Format-check a directly presented Betterflag key. Returns null when the bearer
 * is not a Betterflag key at all (then the OAuth provider validates it as a
 * token), a Response for Betterflag-key-shaped-but-invalid credentials, or the
 * accepted key.
 */
function checkDirectKey(request: Request): { apiKey: string } | Response | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || !match[1]) return null;

  const key = match[1].trim();
  if (!key.startsWith("bf_")) return null; // OAuth access token, not ours to judge.

  if (!API_KEY_RE.test(key)) {
    return unauthorized("That does not look like a Betterflag API key.", request);
  }
  const kind = kindOfKey(key);
  if (kind === "sdk") {
    return unauthorized(
      "SDK keys (bf_sdk_*) only work against the evaluation API, not the MCP server.",
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
    attachWorkerTracing(ctx);
    const { pathname } = new URL(request.url);
    const isMcp = pathname === "/mcp";
    const isSse = pathname === "/sse" || pathname === "/sse/message";
    const obs = readObservability(env as unknown as Record<string, unknown>, "betterflag-mcp", {
      environment: env.BETTERFLAG_ENV,
      release: formatRelease({ version: VERSION, gitSha: env.BETTERFLAG_GIT_SHA, override: env.BETTERFLAG_RELEASE }),
      runtime: "worker",
    });
    const route = routeTemplate(pathname);
    const span = obs.tracer.startSpan(`${request.method} ${route}`, {
      kind: "server",
      attributes: { "http.route": route, "http.request.method": request.method },
    });

    const finish = (response: Response): Response => {
      span.setAttribute("http.response.status_code", response.status);
      if (response.status >= 500) span.setStatus("error");
      span.end();
      obs.logger.info("request", {
        status: response.status,
        duration_ms: Math.round(span.durationMs() * 1000) / 1000,
        "event.name": `${request.method} ${route}`,
        "event.outcome": eventOutcomeFromStatus(response.status),
        path: route,
      });
      obs.flushTo(ctx.waitUntil.bind(ctx));
      return response;
    };

    try {
      if (isMcp || isSse) {
        if (request.method === "OPTIONS") {
          return finish(new Response(null, { status: 204, headers: MCP_CORS_HEADERS }));
        }

        const direct = checkDirectKey(request);
        if (direct instanceof Response || direct) {
          const log = obs.logger.child({ path: pathname, method: request.method });

          if (direct instanceof Response) {
            log.warn("mcp: direct key rejected at the gate", {
              status: 401,
              transport: isSse ? "sse" : "mcp",
              "event.name": "mcp.auth",
              "event.outcome": "client_error",
            });
            return finish(withMcpCors(direct));
          }

          log.info("mcp: session authorized (direct key)", {
            key_kind: kindOfKey(direct.apiKey),
            transport: isSse ? "sse" : "mcp",
            "event.name": "mcp.auth",
            "event.outcome": "ok",
          });

          const props: SessionProps = { apiKey: direct.apiKey, via: "bearer" };
          (ctx as unknown as { props: SessionProps }).props = props;
          const response = isSse
            ? await sseHandler.fetch(request, env, ctx)
            : await mcpHandler.fetch(request, env, ctx);
          return finish(withMcpCors(response));
        }
      }

      const response = await oauthProvider.fetch(request, env as never, ctx);
      return finish(isMcp || isSse ? withMcpCors(response) : response);
    } catch (error) {
      span.recordException(error).end();
      obs.logger.error("mcp request failed", {
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        "event.name": `${request.method} ${route}`,
        "event.outcome": "error",
      });
      obs.flushTo(ctx.waitUntil.bind(ctx));
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * ShipOS MCP server — Cloudflare Worker entry (mcp.shipos.app).
 *
 * Auth model: the Worker gates every MCP request on a ShipOS agent key
 * (sos_agt_*, admin sos_adm_* also accepted) sent as `Authorization: Bearer`.
 * The key is validated for FORMAT only here — the control plane verifies it
 * on every wrapped REST call. It travels to the agent via ctx.props and is
 * never logged.
 *
 * Endpoints:
 *   POST/GET /mcp — streamable HTTP transport (primary)
 *   GET  /sse, POST /sse/message — legacy SSE transport
 *   GET  /  or /health — unauthenticated service info
 */
import { API_KEY_RE, kindOfKey } from "@shipos/core";
import { ShipOSMcp } from "./agent";
import type { Env, SessionProps } from "./types";

export { ShipOSMcp };

const mcpHandler = ShipOSMcp.serve("/mcp", { binding: "MCP_OBJECT" });
const sseHandler = ShipOSMcp.serveSSE("/sse", { binding: "MCP_OBJECT" });

const KEY_HINT =
  "Send `Authorization: Bearer sos_agt_…` — create an agent key in the ShipOS dashboard under Keys.";

function json(status: number, body: unknown): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (status === 401) headers["www-authenticate"] = 'Bearer realm="ShipOS MCP"';
  return new Response(JSON.stringify(body), { status, headers });
}

function unauthorized(message: string): Response {
  return json(401, { error: { code: "unauthorized", message: `${message} ${KEY_HINT}` } });
}

/** Extract and format-check the bearer key. Returns a Response on failure. */
function authenticate(request: Request): { apiKey: string } | Response {
  const header = request.headers.get("authorization");
  if (!header) return unauthorized("Missing Authorization header.");

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || !match[1]) return unauthorized("Malformed Authorization header.");

  const key = match[1].trim();
  if (!API_KEY_RE.test(key)) {
    return unauthorized("That does not look like a ShipOS API key.");
  }
  const kind = kindOfKey(key);
  if (kind === "sdk") {
    return unauthorized(
      "SDK keys (sos_sdk_*) only work against the edge evaluation API, not the MCP server.",
    );
  }
  if (kind !== "agent" && kind !== "admin") {
    return unauthorized("Unsupported key type.");
  }
  return { apiKey: key };
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/" || pathname === "/health") {
      return json(200, {
        name: "shipos-mcp",
        status: "ok",
        transport: { streamableHttp: "/mcp", sse: "/sse" },
        docs: "https://shipos.app/docs/mcp",
      });
    }

    const isMcp = pathname === "/mcp";
    const isSse = pathname === "/sse" || pathname === "/sse/message";
    if (!isMcp && !isSse) {
      return json(404, { error: { code: "not_found", message: "Unknown path. MCP lives at /mcp (or /sse for legacy clients)." } });
    }

    const auth = authenticate(request);
    if (auth instanceof Response) return auth;

    // Hand the key to the McpAgent session. ExecutionContext.props is typed
    // readonly in workers-types but is the documented handoff channel for the
    // agents SDK — isolate the cast here.
    const props: SessionProps = { apiKey: auth.apiKey };
    (ctx as unknown as { props: SessionProps }).props = props;

    return isSse ? sseHandler.fetch(request, env, ctx) : mcpHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

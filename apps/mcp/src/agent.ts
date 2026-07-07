/**
 * The MCP agent Durable Object. One instance per MCP session; the caller's
 * ShipOS key arrives via props (set on ctx.props by the Worker fetch handler
 * in index.ts) and is read lazily at tool-call time, never logged.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { formatRelease, readObservability, type Observability } from "@shipos/observability";
import { ToolError } from "./errors";
import { registerTools } from "./tools";
import type { ApiCtx, Env, SessionProps } from "./types";
import { VERSION } from "./version.gen";

const DEFAULT_API_URL = "https://app.shipos.app";

export class ShipOSMcp extends McpAgent<Env, unknown, SessionProps> {
  server = new McpServer({
    name: "shipos",
    version: VERSION,
  });

  /** Built once per Durable Object (MCP session); reused across tool calls. */
  private obs: Observability | undefined;

  async init(): Promise<void> {
    this.obs = readObservability(this.env as unknown as Record<string, unknown>, "shipos-mcp", {
      environment: this.env.SHIPOS_ENV,
      release: formatRelease({
        version: VERSION,
        gitSha: this.env.SHIPOS_GIT_SHA,
        override: this.env.SHIPOS_RELEASE,
      }),
    });

    registerTools(this.server, (): ApiCtx => {
      const apiKey = this.props?.apiKey;
      if (typeof apiKey !== "string" || apiKey.length === 0) {
        throw new ToolError(
          "This MCP session has no ShipOS key attached. Reconnect with an " +
            "Authorization: Bearer sos_agt_… header (create an agent key in the ShipOS dashboard under Keys).",
        );
      }
      const baseUrl = (this.env.SHIPOS_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
      return { baseUrl, apiKey, obs: this.obs };
    });
  }
}

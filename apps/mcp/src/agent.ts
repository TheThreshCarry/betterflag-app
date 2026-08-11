/**
 * The MCP agent Durable Object. One instance per MCP session; the caller's
 * Betterflag key arrives via props (set on ctx.props by the Worker fetch handler
 * in index.ts) and is read lazily at tool-call time, never logged.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { formatRelease, readObservability, type Observability } from "@betterflag/observability";
import { ToolError } from "./errors";
import { registerTools } from "./tools";
import type { ApiCtx, Env, SessionProps } from "./types";
import { VERSION } from "./version.gen";

const DEFAULT_API_URL = "https://app.betterflag.app";

export class BetterFlagMcp extends McpAgent<Env, unknown, SessionProps> {
  server = new McpServer({
    name: "betterflag",
    title: "Betterflag",
    version: VERSION,
    websiteUrl: "https://betterflag.app",
    // MCP spec icons (2025-11+): clients that support them render these;
    // others fall back to fetching /favicon.ico from the worker origin.
    icons: [
      { src: "https://mcp.betterflag.app/icon.png", mimeType: "image/png", sizes: ["256x256"] },
      { src: "https://mcp.betterflag.app/icon.svg", mimeType: "image/svg+xml" },
    ],
  });

  /** Built once per Durable Object (MCP session); reused across tool calls. */
  private obs: Observability | undefined;

  async init(): Promise<void> {
    this.obs = readObservability(this.env as unknown as Record<string, unknown>, "betterflag-mcp", {
      environment: this.env.BETTERFLAG_ENV,
      release: formatRelease({
        version: VERSION,
        gitSha: this.env.BETTERFLAG_GIT_SHA,
        override: this.env.BETTERFLAG_RELEASE,
      }),
    });

    registerTools(this.server, (): ApiCtx => {
      const apiKey = this.props?.apiKey;
      if (typeof apiKey !== "string" || apiKey.length === 0) {
        throw new ToolError(
          "This MCP session has no Betterflag key attached. Reconnect with an " +
            "Authorization: Bearer bf_agt_… header (create an agent key in the Betterflag dashboard under Keys).",
        );
      }
      const baseUrl = (this.env.BETTERFLAG_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
      return { baseUrl, apiKey, obs: this.obs };
    });
  }
}

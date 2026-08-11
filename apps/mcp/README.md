# @betterflag/mcp, the Betterflag MCP server

A Cloudflare Worker at **`mcp.betterflag.app`** that lets coding agents (Claude
Code, Cursor, anything MCP-capable) manage Betterflag feature flags directly:
create flags, toggle them per environment, ramp percentage rollouts, set
targeting rules, pull kill switches, read evaluation stats and the audit
log, all as first-class MCP tools wrapping the control-plane REST API
(`docs/CONTRACTS.md`).

A valid agent key executes directly, no human-approval step. Every action is
audited (agents by their key prefix) and every flag has an instant kill switch,
so risky changes stay reversible and traceable.

## Connect via OAuth (recommended)

Any OAuth-capable MCP client (Claude.ai, Claude Code, Cursor, …) can connect
with **no key handling at all**: add `https://mcp.betterflag.app/mcp` as a
remote server and click **Connect**. The flow:

1. The client registers itself (dynamic client registration, RFC 7591) and
   opens the browser at `/authorize`.
2. The worker parks the request and redirects to the dashboard consent
   screen (`app.betterflag.app/mcp/consent`), where you sign in and **pick which
   organization** the connection may access.
3. Approving mints a dedicated agent key for the connection
   (`source: oauth`, visible on the Keys page and exempt from the plan
   agent-key limit). The key rides encrypted inside the OAuth grant; the
   client only ever sees opaque access/refresh tokens.

Disconnect any time by revoking that key on the Keys page: tokens keep
working until expiry at most an hour, and every wrapped REST call
re-verifies the key, so revocation cuts access immediately.

## Connect with an agent key (manual)

Add to your project's `.mcp.json` (create an **agent key** in the Betterflag
dashboard under **Keys**):

```json
{
  "mcpServers": {
    "@betterflag/sdk": {
      "type": "http",
      "url": "https://mcp.betterflag.app/mcp",
      "headers": {
        "Authorization": "Bearer bf_agt_..."
      }
    }
  }
}
```

Or from the CLI:

```sh
claude mcp add --transport http betterflag https://mcp.betterflag.app/mcp \
  --header "Authorization: Bearer bf_agt_..."
```

Legacy SSE clients can connect to `https://mcp.betterflag.app/sse` with the same
header. Admin keys (`bf_adm_*`) also work; SDK keys (`bf_sdk_*`) do not -
those are for the evaluation API.

## Tools

| Tool | What it does |
|---|---|
| `read_docs` | Built-in setup docs: quickstart, sdk-js, sdk-react, mcp-setup, targeting, concepts |
| `list_flags` | All flags in a project with per-env state (✅ on / ⬜ off / 🔴 killed) and rollout % |
| `get_flag` | Full detail: per-env config, targeting rules pretty-printed, versions |
| `create_flag` | Create a flag (boolean/string/number/json); replies with a paste-ready SDK snippet |
| `update_flag` | Rename / re-describe a flag |
| `archive_flag` | Soft-archive; SDKs fall back to the default value |
| `toggle_flag` | Turn a flag on/off in one environment |
| `set_rollout` | Set the % rollout (stable bucketing, raising only adds users) |
| `set_targeting` | Replace targeting rules (validated client-side before the API sees them) |
| `kill_flag` | Emergency kill switch, OFF for 100% of traffic in seconds |
| `promote_config` | Copy a full env config, e.g. staging → prod |
| `get_evaluation_stats` | on/off/total evaluation counts over 24h / 7d / 30d |
| `get_audit_log` | Who did what, when, humans by email, agents by key prefix |

`projectSlug` is optional everywhere: with a single project it's inferred;
with several, the tool answers with the list so the agent can pick.

## What it looks like

> **You:** gate the new checkout behind a flag, roll it out to 10% in prod
>
> **Claude** → `create_flag { key: "checkout-v2", description: "New checkout flow" }`
>
> ```
> ✅ Created flag "checkout-v2" (boolean) in project "shop".
> All environments start OFF, toggle_flag turns it on, set_rollout ramps it gradually.
>
> Ready to paste into your code:
>   const on = await betterflag.flag("checkout-v2", { userId, default: false });
> ```
>
> *Claude wires the flag into the checkout entry point, then:*
>
> **Claude** → `set_rollout { key: "checkout-v2", env: "prod", percent: 10 }`
>
> ```
> 📈 Rollout for "checkout-v2" in prod: 0% → 10%.
> Bucketing is stable: users hash to fixed buckets, so raising the percentage
> only adds users, nobody who already has the flag loses it.
> ```
>
> **Claude** → `toggle_flag { key: "checkout-v2", env: "prod", on: true }`
>
> ```
> ✅ "checkout-v2" is now ON in prod.
> ```
>
> Later, an incident, pull the kill switch:
>
> **Claude** → `kill_flag { key: "checkout-v2", env: "prod" }`
>
> ```
> 🔴 Kill switch pulled: "checkout-v2" now serves OFF to 100% of traffic in prod.
> The change takes the KV fast path and reaches the edge within seconds.
> ```

## Architecture

- `src/index.ts`, Worker entry. Direct `bf_agt_*` / `bf_adm_*` bearers are
  format-checked (via `@betterflag/core`) and handed to the session via
  `ctx.props`; everything else flows through
  `@cloudflare/workers-oauth-provider`, which validates OAuth tokens (grant
  props carry the per-connection agent key) and serves `/token`, `/register`
  and the `/.well-known` metadata. The control plane does the real key
  verification on every call.
- `src/oauth.ts`, the OAuth `defaultHandler`: `/authorize` (parks the request
  in `OAUTH_KV`, redirects to the dashboard consent screen) and the
  shared-secret `/internal/oauth/txn/:id` + `/internal/oauth/decision`
  endpoints the dashboard uses to render consent and complete the grant.
- `src/agent.ts`, `BetterFlagMcp`, a Durable-Object-backed `McpAgent`
  (Cloudflare agents SDK) serving streamable HTTP at `/mcp` and SSE at `/sse`.
- `src/tools.ts`, the 12 tools; every one a thin fetch to
  `${BETTERFLAG_API_URL}/api/v1/...` with the caller's key.
- `src/api.ts`, REST client: maps HTTP errors to agent-actionable
  messages (revoked key, plan limit, flag not found, version conflict).
- `src/rules.ts`, zod v3 mirror of `@betterflag/core`'s `targetingRuleSchema`
  for instant client-side rule validation.

## Develop

```sh
pnpm --filter @betterflag/mcp typecheck
pnpm --filter @betterflag/mcp dev        # wrangler dev
# point tools at a local control plane:
wrangler dev --var BETTERFLAG_API_URL:http://localhost:3000 --var BETTERFLAG_DASHBOARD_URL:http://localhost:3000
```

### OAuth one-time setup (deploy)

```sh
wrangler kv namespace create OAUTH_KV        # paste the id into wrangler.jsonc
openssl rand -hex 32 | wrangler secret put MCP_OAUTH_SHARED_SECRET
# put the SAME value in the dashboard env as MCP_OAUTH_SHARED_SECRET,
# and set BETTERFLAG_MCP_URL=https://mcp.betterflag.app there (see apps/dashboard/.env.example)
```

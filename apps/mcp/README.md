# @shipos/mcp — the ShipOS MCP server

A Cloudflare Worker at **`mcp.shipos.app`** that lets coding agents (Claude
Code, Cursor, anything MCP-capable) manage ShipOS feature flags directly:
create flags, toggle them per environment, ramp percentage rollouts, set
targeting rules, pull kill switches, read evaluation stats and the audit
log — all as first-class MCP tools wrapping the control-plane REST API
(`docs/CONTRACTS.md`).

Dangerous actions (production kill-switch, 100% rollout, promote-to-prod)
can be guardrailed per org: instead of executing, the API stages the change
and the tool reports a pending **approval** a human confirms in the
dashboard. The agent never gets a scary error — it gets a status it can poll
with `request_approval_status`.

## Connect from Claude Code

Add to your project's `.mcp.json` (create an **agent key** in the ShipOS
dashboard under **Keys**):

```json
{
  "mcpServers": {
    "shipos": {
      "type": "http",
      "url": "https://mcp.shipos.app/mcp",
      "headers": {
        "Authorization": "Bearer sos_agt_..."
      }
    }
  }
}
```

Or from the CLI:

```sh
claude mcp add --transport http shipos https://mcp.shipos.app/mcp \
  --header "Authorization: Bearer sos_agt_..."
```

Legacy SSE clients can connect to `https://mcp.shipos.app/sse` with the same
header. Admin keys (`sos_adm_*`) also work; SDK keys (`sos_sdk_*`) do not —
those are for the edge evaluation API.

## Tools

| Tool | What it does |
|---|---|
| `list_flags` | All flags in a project with per-env state (✅ on / ⬜ off / 🔴 killed) and rollout % |
| `get_flag` | Full detail: per-env config, targeting rules pretty-printed, versions |
| `create_flag` | Create a flag (boolean/string/number/json); replies with a paste-ready SDK snippet |
| `update_flag` | Rename / re-describe a flag |
| `archive_flag` | Soft-archive; SDKs fall back to the default value |
| `toggle_flag` | Turn a flag on/off in one environment |
| `set_rollout` | Set the % rollout (stable bucketing — raising only adds users) |
| `set_targeting` | Replace targeting rules (validated client-side before the API sees them) |
| `kill_flag` | Emergency kill switch — OFF for 100% of traffic in seconds |
| `promote_config` | Copy a full env config, e.g. staging → prod |
| `get_evaluation_stats` | on/off/total evaluation counts over 24h / 7d / 30d |
| `get_audit_log` | Who did what, when — humans by email, agents by key prefix |
| `request_approval_status` | Poll a guardrail approval: pending / approved / rejected |

`projectSlug` is optional everywhere: with a single project it's inferred;
with several, the tool answers with the list so the agent can pick.

## What it looks like

> **You:** gate the new checkout behind a flag, roll it out to 10% in prod
>
> **Claude** → `create_flag { key: "checkout-v2", description: "New checkout flow" }`
>
> ```
> ✅ Created flag "checkout-v2" (boolean) in project "shop".
> All environments start OFF — toggle_flag turns it on, set_rollout ramps it gradually.
>
> Ready to paste into your code:
>   const on = await shipos.flag("checkout-v2", { userId, default: false });
> ```
>
> *Claude wires the flag into the checkout entry point, then:*
>
> **Claude** → `set_rollout { key: "checkout-v2", env: "prod", percent: 10 }`
>
> ```
> 📈 Rollout for "checkout-v2" in prod: 0% → 10%.
> Bucketing is stable: users hash to fixed buckets, so raising the percentage
> only adds users — nobody who already has the flag loses it.
> ```
>
> **Claude** → `toggle_flag { key: "checkout-v2", env: "prod", on: true }`
>
> ```
> ✅ "checkout-v2" is now ON in prod.
> ```
>
> Later, an incident — but prod kills are guardrailed:
>
> **Claude** → `kill_flag { key: "checkout-v2", env: "prod" }`
>
> ```
> 🛡️ Guardrail: the prod kill-switch for "checkout-v2" requires human approval.
> Nothing has been changed yet. Approval request 8f3a… is now pending in the
> ShipOS dashboard (→ /approvals).
> Check status with request_approval_status(approvalId="8f3a…").
> Once a teammate approves, the change executes immediately.
> ```

## Architecture

- `src/index.ts` — Worker entry. Validates the `Authorization: Bearer` key
  **format** (`sos_agt_*` / `sos_adm_*` via `@shipos/core`), rejects everything
  else with a helpful 401, and hands the key to the session via `ctx.props`.
  The control plane does the real verification on every call.
- `src/agent.ts` — `ShipOSMcp`, a Durable-Object-backed `McpAgent`
  (Cloudflare agents SDK) serving streamable HTTP at `/mcp` and SSE at `/sse`.
- `src/tools.ts` — the 13 tools; every one a thin fetch to
  `${SHIPOS_API_URL}/api/v1/...` with the caller's key.
- `src/api.ts` — REST client: 202 → approval flow, error → agent-actionable
  message (revoked key, plan limit, flag not found, version conflict).
- `src/rules.ts` — zod v3 mirror of `@shipos/core`'s `targetingRuleSchema`
  for instant client-side rule validation.

## Develop

```sh
pnpm --filter @shipos/mcp typecheck
pnpm --filter @shipos/mcp dev        # wrangler dev
# point tools at a local control plane:
wrangler dev --var SHIPOS_API_URL:http://localhost:3000
```

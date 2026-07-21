/**
 * Built-in setup documentation served through the `read_docs` MCP tool, so
 * agents can self-serve "how do I set this up" answers (SDK install, MCP
 * connection, targeting rule format, core concepts) without leaving the MCP
 * session or guessing from training data.
 *
 * Content mirrors packages/sdk-js/README.md, packages/sdk-react/README.md
 * and apps/mcp/README.md; keep them in sync when the SDKs change.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const DOC_TOPICS = [
  "index",
  "quickstart",
  "sdk-js",
  "sdk-react",
  "mcp-setup",
  "targeting",
  "concepts",
] as const;

export type DocTopic = (typeof DOC_TOPICS)[number];

const DOCS: Record<DocTopic, { title: string; body: string }> = {
  index: {
    title: "ShipOS docs: available topics",
    body: `# ShipOS docs

Call read_docs with one of these topics:

- quickstart: ship your first flag in 5 minutes (key, install, evaluate)
- sdk-js: @shiposapp/sdk for Node and the browser (API + config reference)
- sdk-react: @shiposapp/react hooks, Next.js App Router patterns, SSR
- mcp-setup: connect this MCP server (OAuth or agent key, .mcp.json)
- targeting: targeting rule format and operators for set_targeting
- concepts: environments, rollouts, kill switch, key types, audit log

Full web documentation: https://docs.shipos.app`,
  },

  quickstart: {
    title: "Quickstart: first flag in 5 minutes",
    body: `# ShipOS quickstart

1. Grab an SDK key from the dashboard: Project → Environment → API keys.
   SDK keys (sos_sdk_...) are publishable: they can only evaluate flags,
   so they are safe to ship to browsers.

2. Install and evaluate:

\`\`\`bash
npm i @shiposapp/sdk
\`\`\`

\`\`\`ts
import { createClient } from "@shiposapp/sdk";

const shipos = createClient({ key: "sos_sdk_your_key_here" });

const enabled = await shipos.flag("new-checkout", { userId: "u_42", default: false });
if (enabled) renderNewCheckout();
\`\`\`

No init ceremony, no waiting. \`flag()\` never throws: on any failure
(network down, typo'd key, flag archived) you get your \`default\` back.

3. Create and control the flag, either in the dashboard or right here via
   MCP tools: create_flag → toggle_flag → set_rollout. New flags start OFF
   at 0% in every environment; enable them once the code is deployed.

Using React? read_docs topic "sdk-react". Details and API reference:
topic "sdk-js" or https://docs.shipos.app`,
  },

  "sdk-js": {
    title: "@shiposapp/sdk: Node & browser SDK",
    body: `# @shiposapp/sdk

Feature flags for Node and the browser. Zero dependencies. Never throws.
Works offline.

\`\`\`bash
npm i @shiposapp/sdk
\`\`\`

\`\`\`ts
import { createClient } from "@shiposapp/sdk";

const shipos = createClient({ key: "sos_sdk_..." });
const enabled = await shipos.flag("new-checkout", { userId: "u_42", default: false });
\`\`\`

## Guarantees

- Every call takes a \`default\`; on network failure, edge outage, or a
  missing flag you get the default back. Never wrap flag checks in
  try/catch. Errors surface via the optional \`onError\` callback.
- Flags are any JSON type: booleans, strings, numbers, objects.

## Identify a user once with signIn

\`\`\`ts
shipos.signIn("user-123", { plan: "pro", region: "eu" });
const checkout = await shipos.flag("new-checkout", { default: false }); // evaluated for user-123
shipos.signOut();
\`\`\`

signIn is purely local (targeting happens at evaluation time) and clears
the evaluation cache. Per-call userId/attributes still win over the
signed-in identity.

## Node

\`\`\`ts
const shipos = createClient({
  key: process.env.SHIPOS_SDK_KEY!,
  onError: (err) => console.warn("[shipos]", err),
});
\`\`\`

The background refresh timer is unref'd, so the client never holds the
process open; no close() needed before exit.

## Browser

\`\`\`ts
const shipos = createClient({
  key: "sos_sdk_...", // publishable
  defaults: { "new-checkout": false, theme: "light" }, // served when offline
});
shipos.on("update", async () => {
  applyTheme(await shipos.flag("theme", { userId, default: "light" }));
});
\`\`\`

## How it works

- Evaluations: POST edge.shipos.app/v1/evaluate, cached in-memory per
  (flag, userId, attributes) for refreshInterval (min 5s).
- country is auto-detected at the edge from the caller's request when not
  passed, so browser-side country targeting needs no setup; explicit
  country always wins (pass it on servers, since detection would see the
  server's location).
- Background polling: GET /v1/snapshot with If-None-Match; on config
  change the cache clears and 'update' fires.
- \`await shipos.ready()\` blocks until the first config fetch settles
  (resolves on failure too, never rejects).

## API

- flag(key, { userId?, attributes?, default }) → Promise<T>: value or default, never throws
- flagDetail(key, opts?) → { value, reason, variation, ruleId?, bucket? }
- allFlags(context?) → Record<string, JsonValue>
- signIn(userId, metadata?) / signOut() / getUser()
- on("update", cb) → unsubscribe
- ready() / close()

## Config options

- key (required): SDK key, sos_sdk_...
- baseUrl: default https://edge.shipos.app
- refreshInterval: poll cadence + cache TTL in ms, default 30000, 0 disables
- defaults: offline fallbacks by flag key
- fetch: custom fetch (tests, proxies)
- onError: observes every swallowed error`,
  },

  "sdk-react": {
    title: "@shiposapp/react: hooks & Next.js",
    body: `# @shiposapp/react

React hooks for ShipOS flags. SSR-safe (useSyncExternalStore), live-updating,
built on @shiposapp/sdk. Hooks never throw; they fall back to your defaults.

\`\`\`bash
npm i @shiposapp/react
\`\`\`

\`\`\`tsx
import { ShipOSProvider, useFlag } from "@shiposapp/react";

function App() {
  return (
    <ShipOSProvider clientKey="sos_sdk_..." user={{ userId: "u_42" }}>
      <Checkout />
    </ShipOSProvider>
  );
}

function Checkout() {
  const newCheckout = useFlag("new-checkout", false);
  return newCheckout ? <NewCheckout /> : <LegacyCheckout />;
}
\`\`\`

useFlag returns defaultValue on the server and first client render (no
hydration mismatch), evaluates on mount, and re-evaluates when config
changes in the dashboard.

## Next.js App Router

The provider owns a browser-side client, so it lives in a client component:

\`\`\`tsx
// app/providers.tsx
"use client";
import { ShipOSProvider } from "@shiposapp/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ShipOSProvider clientKey={process.env.NEXT_PUBLIC_SHIPOS_SDK_KEY!}>
      {children}
    </ShipOSProvider>
  );
}
// then wrap {children} with <Providers> in app/layout.tsx
\`\`\`

## Identify after login

\`\`\`tsx
const shipos = useShipOS();
useEffect(() => {
  if (user) shipos.signIn(user.id, { plan: user.plan });
  else shipos.signOut();
}, [shipos, user]);
\`\`\`

Leave the provider's user prop unset when driving identity this way.

## Server side (RSC, route handlers, middleware)

Hooks are client-only; use @shiposapp/sdk directly:

\`\`\`tsx
import { createClient } from "@shiposapp/sdk";
const shipos = createClient({ key: process.env.SHIPOS_SDK_KEY! });
const enabled = await shipos.flag("new-hero", { default: false });
\`\`\`

Tip: pass server-evaluated values to the provider's \`bootstrap\` prop
(e.g. from await shipos.allFlags(ctx)) so the first client render shows
real values, still hydration-safe.

## Exports

- ShipOSProvider: { client } or { clientKey, baseUrl?, defaults?, refreshInterval? } plus user?, bootstrap?
- useFlag(key, defaultValue, overrides?) → value
- useFlagDetail(key, defaultValue, overrides?) → { value, reason, loading }
- useShipOS() → underlying client
- createFlagStore: advanced/testing`,
  },

  "mcp-setup": {
    title: "Connect the ShipOS MCP server",
    body: `# Connect the ShipOS MCP server

The server lives at https://mcp.shipos.app/mcp (streamable HTTP;
legacy SSE at /sse).

## OAuth (recommended)

Any OAuth-capable MCP client (Claude.ai, Claude Code, Cursor): add
https://mcp.shipos.app/mcp as a remote server and click Connect. You sign
in, pick which organization the connection may access, and approving mints
a dedicated agent key for the connection (visible on the Keys page,
source: oauth). Revoke that key any time to cut access.

## Manual agent key

Create an agent key (sos_agt_...) in the dashboard under Keys, then:

\`\`\`json
{
  "mcpServers": {
    "shipos": {
      "type": "http",
      "url": "https://mcp.shipos.app/mcp",
      "headers": { "Authorization": "Bearer sos_agt_..." }
    }
  }
}
\`\`\`

Or with the Claude Code CLI:

\`\`\`sh
claude mcp add --transport http shipos https://mcp.shipos.app/mcp \\
  --header "Authorization: Bearer sos_agt_..."
\`\`\`

Admin keys (sos_adm_*) also work. SDK keys (sos_sdk_*) do NOT: those are
publishable evaluation credentials for the edge, not management keys.

## Notes

- projectSlug is optional on every tool: with a single project it's
  inferred; with several, tools reply with the list so you can pick.
- Every mutation is audited and attributed to the agent key's prefix.
- Every flag has a kill switch (kill_flag), so risky changes stay
  reversible.`,
  },

  targeting: {
    title: "Targeting rules: format & operators",
    body: `# Targeting rules (set_targeting)

Rules are evaluated in order, FIRST MATCH WINS. Conditions inside a rule
are ANDed. An empty conditions array matches everyone (useful as a final
catch-all). If no rule matches, the flag falls back to its percentage
rollout.

## Shape

\`\`\`json
[
  {
    "id": "beta-testers",
    "description": "Internal + beta cohort",
    "conditions": [
      { "attribute": "plan", "op": "eq", "value": "beta" },
      { "attribute": "region", "op": "in", "value": ["eu", "us"] }
    ],
    "serve": "on",
    "rolloutPct": 50
  }
]
\`\`\`

- id: string, 1–64 chars, unique per rule
- description: optional, ≤512 chars
- conditions: ≤32 per rule; attribute is any user attribute passed to the
  SDK (via flag() attributes or signIn metadata)
- country: auto-detected at the edge from the caller's request (uppercase
  ISO 3166-1 alpha-2, e.g. "FR") when the SDK does not pass one, so
  browser-side country targeting needs no setup. An explicit country
  always wins; server-side SDKs should pass the end user's country
  themselves, since the detected value would be the server's location.
- serve: "on" | "off" - what matching users get
- rolloutPct: optional 0–100; serve applies to only that share of
  matching users (stable bucketing)
- Max 64 rules per flag/environment.

## Operators

eq, neq, in, not_in, contains, gt, gte, lt, lte,
semver_eq, semver_gt, semver_lt

- in / not_in take an array value.
- contains does substring matching on strings.
- gt/gte/lt/lte compare numbers.
- semver_* compare semantic versions, e.g.
  { "attribute": "appVersion", "op": "semver_gt", "value": "2.4.0" }

## Example: France, signed up >2 weeks ago

\`\`\`json
[{
  "id": "fr-established",
  "conditions": [
    { "attribute": "country", "op": "eq", "value": "FR" },
    { "attribute": "signupAt", "op": "lt", "value": 1750000000000 }
  ],
  "serve": "on"
}]
\`\`\``,
  },

  concepts: {
    title: "Core concepts: envs, rollouts, keys, kill switch",
    body: `# ShipOS core concepts

## Environments

Projects start with dev, staging, prod. Every flag has an independent
config per environment: enabled state, rollout %, targeting rules, served
values. promote_config copies a full config between environments
(e.g. staging → prod after a bake).

## Percentage rollouts

set_rollout sets the share of users that get the ON variation. Bucketing
is stable: users hash to fixed buckets, so raising the percentage only
adds users, nobody who already has the flag loses it. New flags start
OFF at 0% everywhere.

## Kill switch

kill_flag forces the OFF value for 100% of traffic in one environment,
bypassing rollout and rules. It takes the KV fast path and reaches the
edge in seconds. Clear the kill (dashboard, or a config update with
clearKill) before re-enabling.

## Key types

- sos_sdk_* - SDK keys: publishable, evaluation-only, safe in browsers.
  Used by @shiposapp/sdk against edge.shipos.app.
- sos_agt_* - agent keys: management access for MCP/REST, scoped and
  audited by key prefix. What agents should use.
- sos_adm_* - admin keys: management access for humans/CI.
SDK keys are rejected on the control plane; agent/admin keys are rejected
on the edge evaluation path.

## Audit log

Every mutation is logged (humans by email, agents by key prefix): what
action, which flag/env, when. get_audit_log reads it (filter by
actorType: user|agent).

## Evaluation stats

get_evaluation_stats returns on/off/total counts and a client-country
breakdown per flag/environment over 24h/7d/30d/90d (longer periods need
the plan's analytics retention).

## Pricing meter

One meter: flag evaluations. Unlimited flags, seats, environments, and
agent keys on every plan; only Starter caps projects (3).`,
  },
};

export function registerDocsTool(server: McpServer): void {
  server.registerTool(
    "read_docs",
    {
      title: "Read ShipOS documentation",
      description:
        "Read built-in ShipOS setup documentation. Topics: quickstart (first flag in 5 min), " +
        "sdk-js (Node/browser SDK), sdk-react (React hooks + Next.js), mcp-setup (connect this server), " +
        "targeting (rule format & operators for set_targeting), concepts (environments, rollouts, " +
        "kill switch, key types). Call without a topic (or with 'index') to list all topics. " +
        "Use this before wiring SDKs or writing targeting rules instead of guessing.",
      inputSchema: {
        topic: z
          .enum(DOC_TOPICS)
          .optional()
          .describe("Doc topic to read; omit for the index of available topics."),
      },
    },
    async ({ topic }) => {
      const doc = DOCS[topic ?? "index"];
      return { content: [{ type: "text", text: doc.body }] };
    },
  );
}

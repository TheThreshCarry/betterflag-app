/**
 * The ShipOS MCP tool surface. Tool names are PUBLIC PRODUCT API — do not
 * rename. Every tool is a thin wrapper over the control-plane REST API
 * (docs/CONTRACTS.md); a valid agent/admin key executes mutations directly.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  apiFetch,
  configsOf,
  normalizeFlag,
  pluckArray,
  resolveFlag,
  resolveProject,
  rolloutPctOf,
} from "./api";
import { ToolError } from "./errors";
import { auditLine, flagDetail, flagSummaryLine, renderRule, statsTable } from "./format";
import {
  describeRuleIssues,
  jsonValueInputSchema,
  targetingRulesInputSchema,
  targetingRulesSchema,
} from "./rules";
import type { ApiCtx, AuditEntry, Flag, StatsRow } from "./types";

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

function text(t: string, isError = false): CallToolResult {
  return isError
    ? { content: [{ type: "text", text: t }], isError: true }
    : { content: [{ type: "text", text: t }] };
}

/** Uniform exception → tool-result mapping. */
async function run(fn: () => Promise<string>): Promise<CallToolResult> {
  try {
    return text(await fn());
  } catch (e) {
    if (e instanceof ToolError) return text(e.message, e.isError);
    // Genuinely unexpected (a bug, not a mapped API error). Structured
    // API-error telemetry is emitted in apiFetch; this console.error is the
    // floor for everything else (captured in Workers Logs).
    console.error("[mcp] unexpected tool error", e);
    return text(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

// Shared parameter schemas (zod v3).
const projectSlugParam = z
  .string()
  .min(1)
  .optional()
  .describe("Project slug. Optional — when the org has exactly one project it is used automatically.");
const keyParam = z.string().min(1).describe('Flag key, e.g. "checkout-v2".');
const envParam = z.string().min(1).describe("Environment slug (projects start with dev, staging, prod).");
const flagKeyFormat = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "flag keys may contain letters, digits, '.', '_' and '-' and must start alphanumeric")
  .describe('New flag key, e.g. "checkout-v2". Letters, digits, ".", "_", "-".');

const FLAG_LIST_KEYS = ["flags", "data", "items"] as const;

export function registerTools(server: McpServer, getCtx: () => ApiCtx): void {
  // -------------------------------------------------------------------------
  // Read tools
  // -------------------------------------------------------------------------

  server.registerTool(
    "list_flags",
    {
      title: "List feature flags",
      description:
        "List every feature flag in a ShipOS project with its per-environment state " +
        "(✅ on / ⬜ off / 🔴 killed) and rollout percentage.",
      inputSchema: { projectSlug: projectSlugParam },
    },
    async ({ projectSlug }) =>
      run(async () => {
        const ctx = getCtx();
        const project = await resolveProject(ctx, projectSlug);
        const payload = await apiFetch(ctx, {
          method: "GET",
          path: `/api/v1/projects/${project.id}/flags`,
        });
        const flags = pluckArray<Flag>(payload, FLAG_LIST_KEYS);
        if (!flags) throw new ToolError("Unexpected response from the flags list endpoint — no flag array found.");

        const active = flags.filter((f) => !(f.archivedAt ?? f.archived_at));
        const archived = flags.length - active.length;
        const slug = project.slug ?? project.id;
        if (active.length === 0) {
          return `Project "${slug}" has no active flags${archived > 0 ? ` (${archived} archived)` : ""}. Create one with create_flag.`;
        }
        const lines = [
          `Flags in project "${slug}" (${active.length} active${archived > 0 ? `, ${archived} archived` : ""}):`,
          "",
          ...active.map(flagSummaryLine),
        ];
        return lines.join("\n");
      }),
  );

  server.registerTool(
    "get_flag",
    {
      title: "Get flag detail",
      description:
        "Full detail for one flag: per-environment config (state, rollout, config version), " +
        "targeting rules pretty-printed, and served values.",
      inputSchema: { projectSlug: projectSlugParam, key: keyParam },
    },
    async ({ projectSlug, key }) =>
      run(async () => {
        const ctx = getCtx();
        const { project, flag } = await resolveFlag(ctx, projectSlug, key);
        return flagDetail(flag, project.slug);
      }),
  );

  // -------------------------------------------------------------------------
  // Flag lifecycle
  // -------------------------------------------------------------------------

  server.registerTool(
    "create_flag",
    {
      title: "Create a feature flag",
      description:
        "Create a new feature flag. Every environment starts OFF at 0% — enable it with " +
        "toggle_flag / set_rollout when the code is deployed behind it.",
      inputSchema: {
        projectSlug: projectSlugParam,
        key: flagKeyFormat,
        name: z.string().min(1).max(256).optional().describe("Display name; defaults to the key."),
        description: z.string().max(2048).optional(),
        kind: z
          .enum(["boolean", "string", "number", "json"])
          .optional()
          .describe("Flag kind; defaults to boolean."),
        defaultValue: jsonValueInputSchema
          .optional()
          .describe("Value served when the flag is missing or archived (any JSON value)."),
      },
    },
    async ({ projectSlug, key, name, description, kind, defaultValue }) =>
      run(async () => {
        const ctx = getCtx();
        const project = await resolveProject(ctx, projectSlug);
        const body: Record<string, unknown> = { key, name: name ?? key, kind: kind ?? "boolean" };
        if (description !== undefined) body.description = description;
        if (defaultValue !== undefined) body.defaultValue = defaultValue;
        const payload = await apiFetch(ctx, {
          method: "POST",
          path: `/api/v1/projects/${project.id}/flags`,
          body,
        });
        const created = normalizeFlag(payload);
        const slug = project.slug ?? project.id;
        return [
          `✅ Created flag "${created?.key ?? key}" (${kind ?? "boolean"}) in project "${slug}".`,
          "All environments start OFF — toggle_flag turns it on, set_rollout ramps it gradually.",
          "",
          "Ready to paste into your code:",
          `  const on = await shipos.flag("${key}", { userId, default: false });`,
        ].join("\n");
      }),
  );

  server.registerTool(
    "update_flag",
    {
      title: "Update flag metadata",
      description: "Rename a flag or update its description (metadata only — does not touch any environment config).",
      inputSchema: {
        projectSlug: projectSlugParam,
        key: keyParam,
        name: z.string().min(1).max(256).optional(),
        description: z.string().max(2048).optional(),
      },
    },
    async ({ projectSlug, key, name, description }) =>
      run(async () => {
        if (name === undefined && description === undefined) {
          throw new ToolError("Nothing to update — pass name and/or description.", { isError: false });
        }
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        await apiFetch(ctx, {
          method: "PATCH",
          path: `/api/v1/flags/${flag.id}`,
          body,
          flagKey: key,
        });
        const changed = [name !== undefined ? `name → "${name}"` : null, description !== undefined ? "description" : null]
          .filter((s): s is string => s !== null)
          .join(", ");
        return `✏️ Updated flag "${key}" (${changed}).`;
      }),
  );

  server.registerTool(
    "archive_flag",
    {
      title: "Archive a flag",
      description:
        "Soft-archive a flag. It stops evaluating (SDKs serve the default value) but its history is kept. " +
        "Clean up dead code paths referencing it when convenient.",
      inputSchema: { projectSlug: projectSlugParam, key: keyParam },
    },
    async ({ projectSlug, key }) =>
      run(async () => {
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        await apiFetch(ctx, {
          method: "DELETE",
          path: `/api/v1/flags/${flag.id}`,
          flagKey: key,
        });
        return `🗄️ Archived flag "${key}". SDKs now receive its default value; the flag and its audit history remain visible in the dashboard.`;
      }),
  );

  // -------------------------------------------------------------------------
  // Per-environment config
  // -------------------------------------------------------------------------

  server.registerTool(
    "toggle_flag",
    {
      title: "Toggle a flag on/off",
      description: "Turn a flag ON or OFF in one environment.",
      inputSchema: {
        projectSlug: projectSlugParam,
        key: keyParam,
        env: envParam,
        on: z.boolean().describe("true = enable, false = disable."),
      },
    },
    async ({ projectSlug, key, env, on }) =>
      run(async () => {
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        await apiFetch(ctx, {
          method: "PUT",
          path: `/api/v1/flags/${flag.id}/environments/${encodeURIComponent(env)}/config`,
          body: { enabled: on },
          flagKey: key,
        });
        const current = configsOf(flag).find((c) => c.env === env);
        const pct = current ? rolloutPctOf(current.cfg) : undefined;
        const rolloutNote =
          on && pct !== undefined && pct < 100
            ? `\nRollout is at ${pct}% — only that share of users gets the ON variation. Use set_rollout to ramp it.`
            : "";
        return `${on ? "✅" : "⬜"} "${key}" is now ${on ? "ON" : "OFF"} in ${env}.${rolloutNote}`;
      }),
  );

  server.registerTool(
    "set_rollout",
    {
      title: "Set percentage rollout",
      description:
        "Set the percentage of users that get the ON variation in one environment. " +
        "Bucketing is stable — raising the percentage only adds users, nobody flips back.",
      inputSchema: {
        projectSlug: projectSlugParam,
        key: keyParam,
        env: envParam,
        percent: z.number().int().min(0).max(100).describe("0–100."),
      },
    },
    async ({ projectSlug, key, env, percent }) =>
      run(async () => {
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        const current = configsOf(flag).find((c) => c.env === env);
        const oldPct = current ? rolloutPctOf(current.cfg) : undefined;
        await apiFetch(ctx, {
          method: "PUT",
          path: `/api/v1/flags/${flag.id}/environments/${encodeURIComponent(env)}/config`,
          body: { rolloutPct: percent },
          flagKey: key,
        });
        const transition = oldPct !== undefined ? `${oldPct}% → ${percent}%` : `now ${percent}%`;
        const offNote =
          current && current.cfg.enabled === false
            ? `\nNote: "${key}" is currently OFF in ${env} — the rollout takes effect once you toggle_flag it on.`
            : "";
        return [
          `📈 Rollout for "${key}" in ${env}: ${transition}.`,
          "Bucketing is stable: users hash to fixed buckets, so raising the percentage only adds users — nobody who already has the flag loses it.",
        ].join("\n") + offNote;
      }),
  );

  server.registerTool(
    "set_targeting",
    {
      title: "Set targeting rules",
      description:
        "Replace the targeting rules for a flag in one environment. Rules are evaluated in order, " +
        "first match wins; conditions within a rule are ANDed. An empty conditions array matches everyone.",
      inputSchema: {
        projectSlug: projectSlugParam,
        key: keyParam,
        env: envParam,
        rules: targetingRulesInputSchema.describe(
          "Full replacement rule list (max 64). Each rule: { id, description?, conditions: [{ attribute, op, value }], serve: 'on'|'off', rolloutPct? }.",
        ),
      },
    },
    async ({ projectSlug, key, env, rules }) =>
      run(async () => {
        // Belt-and-braces: mirror @shipos/core validation so agents get
        // instant, precise feedback before anything hits the API.
        const parsed = targetingRulesSchema.safeParse(rules);
        if (!parsed.success) {
          throw new ToolError(`Invalid targeting rules:\n${describeRuleIssues(parsed.error)}`, { isError: false });
        }
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        await apiFetch(ctx, {
          method: "PUT",
          path: `/api/v1/flags/${flag.id}/environments/${encodeURIComponent(env)}/config`,
          body: { rules: parsed.data },
          flagKey: key,
        });
        const rendered = parsed.data.map((r, i) => renderRule(r, i)).join("\n");
        return [
          `🎯 Targeting updated for "${key}" in ${env} — ${parsed.data.length} rule${parsed.data.length === 1 ? "" : "s"} (first match wins):`,
          rendered.length > 0 ? rendered : "    (no rules — flag falls back to its percentage rollout)",
        ].join("\n");
      }),
  );

  server.registerTool(
    "kill_flag",
    {
      title: "Kill switch",
      description:
        "Emergency kill: force the OFF value for 100% of traffic in one environment, bypassing rollout and rules. " +
        "Propagates to the edge in seconds.",
      inputSchema: { projectSlug: projectSlugParam, key: keyParam, env: envParam },
    },
    async ({ projectSlug, key, env }) =>
      run(async () => {
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        await apiFetch(ctx, {
          method: "POST",
          path: `/api/v1/flags/${flag.id}/environments/${encodeURIComponent(env)}/kill`,
          body: {},
          flagKey: key,
        });
        return [
          `🔴 Kill switch pulled: "${key}" now serves OFF to 100% of traffic in ${env}.`,
          "The change takes the KV fast path and reaches the edge within seconds.",
          "Once the incident is over, clear the kill from the dashboard (or a config update with clearKill) before re-enabling.",
        ].join("\n");
      }),
  );

  server.registerTool(
    "promote_config",
    {
      title: "Promote config between environments",
      description:
        "Copy a flag's entire config (enabled state, rollout %, rules, on/off values) from one environment to another — " +
        "e.g. staging → prod after a successful bake.",
      inputSchema: {
        projectSlug: projectSlugParam,
        key: keyParam,
        from_env: z.string().min(1).describe("Source environment slug."),
        to_env: z.string().min(1).describe("Target environment slug."),
      },
    },
    async ({ projectSlug, key, from_env, to_env }) =>
      run(async () => {
        if (from_env === to_env) {
          throw new ToolError("from_env and to_env are the same environment — nothing to promote.", { isError: false });
        }
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        await apiFetch(ctx, {
          method: "POST",
          path: `/api/v1/flags/${flag.id}/environments/${encodeURIComponent(to_env)}/promote`,
          body: { fromEnv: from_env },
          flagKey: key,
        });
        return `🚀 Promoted "${key}": ${to_env} now mirrors ${from_env} (enabled state, rollout %, targeting rules and served values copied).`;
      }),
  );

  // -------------------------------------------------------------------------
  // Observability
  // -------------------------------------------------------------------------

  server.registerTool(
    "get_evaluation_stats",
    {
      title: "Evaluation stats",
      description: "Evaluation counts (on/off/total) for a flag in one environment over 24h, 7d or 30d.",
      inputSchema: {
        projectSlug: projectSlugParam,
        key: keyParam,
        env: envParam,
        period: z.enum(["24h", "7d", "30d"]).optional().describe("Defaults to 24h."),
      },
    },
    async ({ projectSlug, key, env, period }) =>
      run(async () => {
        const ctx = getCtx();
        const { flag } = await resolveFlag(ctx, projectSlug, key);
        const p = period ?? "24h";
        const payload = await apiFetch(ctx, {
          method: "GET",
          path: `/api/v1/flags/${flag.id}/environments/${encodeURIComponent(env)}/stats?period=${p}`,
          flagKey: key,
        });
        const rows = pluckArray<StatsRow>(payload, ["points", "rows", "stats", "data", "series", "buckets"]);
        if (!rows) {
          return `Stats for "${key}" in ${env} (${p}) — raw response:\n${JSON.stringify(payload, null, 2)}`;
        }
        if (rows.length === 0) {
          return `No evaluations recorded for "${key}" in ${env} over the last ${p}. Is the SDK deployed and calling shipos.flag("${key}", …)?`;
        }
        return [`Evaluations for "${key}" in ${env} — last ${p}:`, "", statsTable(rows)].join("\n");
      }),
  );

  server.registerTool(
    "get_audit_log",
    {
      title: "Audit log",
      description:
        "Recent audit entries, newest first: who (human email or agent key prefix), what action, which flag/env, when.",
      inputSchema: {
        projectSlug: projectSlugParam,
        actorType: z.enum(["user", "agent"]).optional().describe("Filter by actor type."),
        limit: z.number().int().min(1).max(200).optional().describe("Max entries (default 20)."),
      },
    },
    async ({ projectSlug, actorType, limit }) =>
      run(async () => {
        const ctx = getCtx();
        const params = new URLSearchParams();
        if (actorType) params.set("actorType", actorType);
        params.set("limit", String(limit ?? 20));
        if (projectSlug !== undefined) {
          const project = await resolveProject(ctx, projectSlug);
          params.set("projectId", project.id);
        }
        const payload = await apiFetch(ctx, { method: "GET", path: `/api/v1/audit?${params.toString()}` });
        const entries = pluckArray<AuditEntry>(payload, ["entries", "items", "data", "audit"]);
        if (!entries) throw new ToolError("Unexpected response from the audit endpoint — no entry array found.");
        if (entries.length === 0) return "No audit entries match that filter yet.";
        return [`Audit log (${entries.length} entries, newest first):`, "", ...entries.map(auditLine)].join("\n");
      }),
  );

}

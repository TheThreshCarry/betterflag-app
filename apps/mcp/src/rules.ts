/**
 * Targeting-rule schemas for the MCP tools.
 *
 * The canonical validation schemas live in @shipos/core and are reused here for
 * runtime `.safeParse` (mcp and core are both on zod 4, so there's nothing to
 * hand-duplicate anymore).
 *
 * The INPUT schemas below are deliberately kept local and shallow: the canonical
 * `jsonValueSchema` is recursive (z.lazy), and feeding a recursive schema into
 * the MCP SDK's `registerTool` makes tsc instantiate the JsonValue type across
 * every tool and blow the Node heap (`tsc` OOMs, exit 137). Advertising a
 * shallow `value: z.unknown()` keeps the tool's inputSchema structure while tsc
 * stays cheap; deep validation still runs at runtime via
 * `targetingRulesSchema.safeParse`.
 */
import { ruleOperatorSchema, targetingRulesSchema } from "@shipos/core";
import { z } from "zod";

export { targetingRulesSchema };

// ---------------------------------------------------------------------------
// Input-only schemas (for MCP tool `inputSchema`) — see file header.
// ---------------------------------------------------------------------------

export const jsonValueInputSchema = z.unknown();

export const ruleConditionInputSchema = z.object({
  attribute: z.string().min(1).max(128),
  op: ruleOperatorSchema,
  value: jsonValueInputSchema,
});

export const targetingRuleInputSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().max(512).optional(),
  conditions: z.array(ruleConditionInputSchema).max(32),
  serve: z.enum(["on", "off"]),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});

export const targetingRulesInputSchema = z.array(targetingRuleInputSchema).max(64);

/** Flatten zod issues into agent-actionable one-per-line feedback. */
export function describeRuleIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - rules${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`)
    .join("\n");
}

/**
 * Client-side validation for targeting rules.
 *
 * Mirrors `targetingRuleSchema` from @shipos/core — but written in zod v3
 * syntax (this app pins zod 3.25 for @modelcontextprotocol/sdk compatibility,
 * while core uses zod v4). Keep in lockstep with packages/core/src/schemas.ts.
 */
import { z } from "zod";
import type { JsonValue } from "@shipos/core";

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const ruleOperatorSchema = z.enum([
  "eq",
  "neq",
  "in",
  "not_in",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "semver_eq",
  "semver_gt",
  "semver_lt",
]);

export const ruleConditionSchema = z.object({
  attribute: z.string().min(1).max(128),
  op: ruleOperatorSchema,
  value: jsonValueSchema,
});

export const targetingRuleSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().max(512).optional(),
  conditions: z.array(ruleConditionSchema).max(32),
  serve: z.enum(["on", "off"]),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});

export const targetingRulesSchema = z.array(targetingRuleSchema).max(64);

/** Flatten zod issues into agent-actionable one-per-line feedback. */
export function describeRuleIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - rules${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`)
    .join("\n");
}

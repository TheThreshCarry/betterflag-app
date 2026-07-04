import { z } from "zod";
import type { JsonValue } from "./types";

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

export const flagKindSchema = z.enum(["boolean", "string", "number", "json"]);

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

export const flagSnapshotEntrySchema = z.object({
  kind: flagKindSchema,
  enabled: z.boolean(),
  killed: z.boolean(),
  rolloutPct: z.number().int().min(0).max(100),
  rules: targetingRulesSchema,
  valueOn: jsonValueSchema,
  valueOff: jsonValueSchema,
  defaultValue: jsonValueSchema,
});

export const projectSnapshotSchema = z.object({
  version: z.number().int().nonnegative(),
  projectId: z.string(),
  environment: z.string(),
  generatedAt: z.string(),
  flags: z.record(z.string(), flagSnapshotEntrySchema),
});

export const evaluationContextSchema = z.object({
  userId: z.string().min(1).max(256).optional(),
  attributes: z.record(z.string(), jsonValueSchema).optional(),
});

/** Flag keys: kebab/dot/underscore, must start alphanumeric. */
export const flagKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "flag keys may contain letters, digits, '.', '_' and '-'");

export type TargetingRuleInput = z.infer<typeof targetingRuleSchema>;

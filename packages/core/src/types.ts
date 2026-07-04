export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FlagKind = "boolean" | "string" | "number" | "json";

export type RuleOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "semver_eq"
  | "semver_gt"
  | "semver_lt";

export interface RuleCondition {
  /** Context attribute to test; "userId" targets the context's userId. */
  attribute: string;
  op: RuleOperator;
  value: JsonValue;
}

export interface TargetingRule {
  id: string;
  description?: string;
  /** All conditions must match (AND). An empty array matches everyone. */
  conditions: RuleCondition[];
  /** Which variation the rule serves when it matches. */
  serve: "on" | "off";
  /**
   * Optional per-rule rollout: of the users this rule matches, only this
   * percentage (bucketed on `${flagKey}:${ruleId}`) get `serve`; the rest
   * fall through to the next rule / the flag-level rollout.
   */
  rolloutPct?: number;
}

export interface FlagSnapshotEntry {
  kind: FlagKind;
  enabled: boolean;
  killed: boolean;
  /** Flag-level percentage rollout of the ON variation, 0..100. */
  rolloutPct: number;
  rules: TargetingRule[];
  valueOn: JsonValue;
  valueOff: JsonValue;
  /** Flag-level default, served for `not_found`-adjacent situations. */
  defaultValue: JsonValue;
}

/** The denormalized config document stored in KV per (project, environment). */
export interface ProjectSnapshot {
  /** Monotonic per (project, environment); bump on every publish. */
  version: number;
  projectId: string;
  environment: string;
  generatedAt: string;
  flags: Record<string, FlagSnapshotEntry>;
}

export interface EvaluationContext {
  userId?: string;
  attributes?: Record<string, JsonValue>;
}

export type EvaluationReason =
  | "killed"
  | "disabled"
  | "rule_match"
  | "rollout"
  | "default"
  | "not_found";

export interface EvaluationResult {
  key: string;
  value: JsonValue;
  variation: "on" | "off" | "default";
  reason: EvaluationReason;
  /** Set when reason === "rule_match". */
  ruleId?: string;
  /** Set when a percentage rollout was consulted (0..99). */
  bucket?: number;
}

export type ActorKind = "sdk" | "agent" | "api";

/** One row bound for ClickHouse. Never contains raw user identifiers. */
export interface EvaluationEvent {
  /** ms-precision ISO timestamp. */
  ts: string;
  org_id: string;
  project_id: string;
  env: string;
  flag_key: string;
  variation: string;
  reason: string;
  actor_kind: ActorKind;
  sdk: string;
  /** FNV-1a 64-bit of the userId, decimal string ("0" when anonymous). */
  user_hash: string;
}

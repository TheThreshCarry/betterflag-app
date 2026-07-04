/**
 * Wire types for the ShipOS edge evaluation API (edge.shipos.app).
 *
 * These are intentionally local copies of the shapes in `@shipos/core` —
 * this package publishes standalone with zero dependencies, so it must not
 * import from workspace-internal packages. If the wire format changes in
 * docs/CONTRACTS.md, update these in the same PR.
 */

/** Any JSON-serializable value. Flag values are always JSON. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Who the flag is being evaluated for. */
export interface EvaluationContext {
  userId?: string;
  attributes?: Record<string, JsonValue>;
}

/** Why the returned value was served. */
export type EvaluationReason =
  | "killed"
  | "disabled"
  | "rule_match"
  | "rollout"
  | "default"
  | "not_found";

/** One evaluated flag, as returned by `POST /v1/evaluate`. */
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

/** Response body of `POST /v1/evaluate` (single key still returns an array). */
export interface EvaluateResponse {
  version: number;
  results: EvaluationResult[];
}

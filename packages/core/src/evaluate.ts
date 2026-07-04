import { bucketFor } from "./bucket";
import { compareSemver, parseSemver } from "./semver";
import type {
  EvaluationContext,
  EvaluationResult,
  FlagSnapshotEntry,
  JsonValue,
  ProjectSnapshot,
  RuleCondition,
  TargetingRule,
} from "./types";

function attributeValue(ctx: EvaluationContext, attribute: string): JsonValue | undefined {
  if (attribute === "userId") return ctx.userId;
  return ctx.attributes?.[attribute];
}

function scalarEquals(a: JsonValue | undefined, b: JsonValue): boolean {
  if (a === undefined) return false;
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function asNumber(v: JsonValue | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function conditionMatches(ctx: EvaluationContext, cond: RuleCondition): boolean {
  const actual = attributeValue(ctx, cond.attribute);

  switch (cond.op) {
    case "eq":
      return scalarEquals(actual, cond.value);
    case "neq":
      return actual !== undefined && !scalarEquals(actual, cond.value);
    case "in":
      return Array.isArray(cond.value) && cond.value.some((v) => scalarEquals(actual, v));
    case "not_in":
      return (
        actual !== undefined &&
        Array.isArray(cond.value) &&
        !cond.value.some((v) => scalarEquals(actual, v))
      );
    case "contains":
      if (typeof actual === "string" && typeof cond.value === "string") {
        return actual.includes(cond.value);
      }
      if (Array.isArray(actual)) {
        return actual.some((v) => scalarEquals(v, cond.value));
      }
      return false;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = asNumber(actual);
      const b = asNumber(cond.value);
      if (a === null || b === null) return false;
      if (cond.op === "gt") return a > b;
      if (cond.op === "gte") return a >= b;
      if (cond.op === "lt") return a < b;
      return a <= b;
    }
    case "semver_eq":
    case "semver_gt":
    case "semver_lt": {
      const a = parseSemver(actual);
      const b = parseSemver(cond.value);
      if (!a || !b) return false;
      const cmp = compareSemver(a, b);
      if (cond.op === "semver_eq") return cmp === 0;
      if (cond.op === "semver_gt") return cmp > 0;
      return cmp < 0;
    }
  }
}

export function ruleMatches(
  ctx: EvaluationContext,
  flagKey: string,
  rule: TargetingRule,
): boolean {
  if (!rule.conditions.every((c) => conditionMatches(ctx, c))) return false;
  if (rule.rolloutPct === undefined || rule.rolloutPct >= 100) return true;
  if (rule.rolloutPct <= 0) return false;
  // Per-rule rollouts bucket on flagKey:ruleId so they are decorrelated from
  // the flag-level rollout. Anonymous contexts are never in a partial rollout.
  if (ctx.userId === undefined) return false;
  return bucketFor(`${flagKey}:${rule.id}`, ctx.userId) < rule.rolloutPct;
}

/**
 * Evaluate a single flag against a context. Pure and deterministic:
 * identical (entry, ctx) always produces an identical result, on the edge
 * worker and in every SDK.
 *
 * Precedence: killed > disabled > rules (in order) > percentage rollout.
 */
export function evaluateFlag(
  key: string,
  entry: FlagSnapshotEntry | undefined,
  ctx: EvaluationContext,
  fallback?: JsonValue,
): EvaluationResult {
  if (!entry) {
    return { key, value: fallback ?? null, variation: "default", reason: "not_found" };
  }

  if (entry.killed) {
    return { key, value: entry.valueOff, variation: "off", reason: "killed" };
  }
  if (!entry.enabled) {
    return { key, value: entry.valueOff, variation: "off", reason: "disabled" };
  }

  for (const rule of entry.rules) {
    if (ruleMatches(ctx, key, rule)) {
      return {
        key,
        value: rule.serve === "on" ? entry.valueOn : entry.valueOff,
        variation: rule.serve,
        reason: "rule_match",
        ruleId: rule.id,
      };
    }
  }

  if (entry.rolloutPct >= 100) {
    return { key, value: entry.valueOn, variation: "on", reason: "default" };
  }
  if (entry.rolloutPct <= 0) {
    return { key, value: entry.valueOff, variation: "off", reason: "default" };
  }

  // Partial rollout requires a stable unit; anonymous contexts get OFF so a
  // user doesn't flap between variations across requests.
  if (ctx.userId === undefined) {
    return { key, value: entry.valueOff, variation: "off", reason: "rollout" };
  }

  const bucket = bucketFor(key, ctx.userId);
  const on = bucket < entry.rolloutPct;
  return {
    key,
    value: on ? entry.valueOn : entry.valueOff,
    variation: on ? "on" : "off",
    reason: "rollout",
    bucket,
  };
}

export function evaluateSnapshot(
  snapshot: ProjectSnapshot,
  keys: string[],
  ctx: EvaluationContext,
): EvaluationResult[] {
  return keys.map((key) => evaluateFlag(key, snapshot.flags[key], ctx));
}

export function evaluateAll(
  snapshot: ProjectSnapshot,
  ctx: EvaluationContext,
): EvaluationResult[] {
  return evaluateSnapshot(snapshot, Object.keys(snapshot.flags), ctx);
}

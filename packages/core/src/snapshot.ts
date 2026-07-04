import { targetingRulesSchema } from "./schemas";
import type {
  FlagKind,
  FlagSnapshotEntry,
  JsonValue,
  ProjectSnapshot,
  TargetingRule,
} from "./types";

/** Shape of a `flags` row as the snapshot builder needs it. */
export interface FlagRowLike {
  key: string;
  kind: FlagKind;
  default_value: JsonValue;
  archived_at: string | null;
}

/** Shape of a `flag_configs` row (already joined to its flag key). */
export interface FlagConfigRowLike {
  flag_key: string;
  enabled: boolean;
  killed: boolean;
  rollout_pct: number;
  rules: unknown;
  value_on: JsonValue | null;
  value_off: JsonValue | null;
  version: number;
}

function defaultOffValue(kind: FlagKind, defaultValue: JsonValue): JsonValue {
  switch (kind) {
    case "boolean":
      return false;
    case "string":
      return typeof defaultValue === "string" ? defaultValue : "";
    case "number":
      return typeof defaultValue === "number" ? defaultValue : 0;
    case "json":
      return defaultValue ?? null;
  }
}

function defaultOnValue(kind: FlagKind, defaultValue: JsonValue): JsonValue {
  return kind === "boolean" ? true : defaultValue ?? null;
}

/**
 * Build the KV snapshot document for one (project, environment) from control
 * plane rows. Shared by the sync worker and the kill-switch fast path in the
 * dashboard so the two can never drift.
 *
 * Rules that fail schema validation are dropped (fail-open to the flag's
 * rollout/default rather than taking the whole snapshot down); the caller
 * receives them in `invalidRules` for logging.
 */
export function buildSnapshot(input: {
  projectId: string;
  environment: string;
  version: number;
  generatedAt: string;
  flags: FlagRowLike[];
  configs: FlagConfigRowLike[];
}): { snapshot: ProjectSnapshot; invalidRules: { flagKey: string; error: string }[] } {
  const configByKey = new Map<string, FlagConfigRowLike>();
  for (const config of input.configs) configByKey.set(config.flag_key, config);

  const invalidRules: { flagKey: string; error: string }[] = [];
  const flags: Record<string, FlagSnapshotEntry> = {};

  for (const flag of input.flags) {
    if (flag.archived_at !== null) continue;
    const config = configByKey.get(flag.key);

    let rules: TargetingRule[] = [];
    if (config?.rules != null) {
      const parsed = targetingRulesSchema.safeParse(config.rules);
      if (parsed.success) {
        rules = parsed.data;
      } else {
        invalidRules.push({ flagKey: flag.key, error: parsed.error.message });
      }
    }

    flags[flag.key] = {
      kind: flag.kind,
      enabled: config?.enabled ?? false,
      killed: config?.killed ?? false,
      rolloutPct: config?.rollout_pct ?? 0,
      rules,
      valueOn: config?.value_on ?? defaultOnValue(flag.kind, flag.default_value),
      valueOff: config?.value_off ?? defaultOffValue(flag.kind, flag.default_value),
      defaultValue: flag.default_value,
    };
  }

  return {
    snapshot: {
      version: input.version,
      projectId: input.projectId,
      environment: input.environment,
      generatedAt: input.generatedAt,
      flags,
    },
    invalidRules,
  };
}

export function snapshotKvKey(projectId: string, environment: string): string {
  return `cfg:${projectId}:${environment}`;
}

export function sdkKeyKvKey(keyPrefix: string): string {
  return `key:${keyPrefix}`;
}

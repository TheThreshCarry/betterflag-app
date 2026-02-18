/**
 * CMS Type Migration Rules
 *
 * Defines the safety classification of schema field type changes
 * for content type versioning.
 *
 * Categories:
 * - Safe (auto-apply): lossless widening conversions
 * - Risky (require user confirmation): potentially lossy conversions
 * - Destructive (block or warn): data loss likely
 */

export type FieldType =
  | "text"
  | "richtext"
  | "number"
  | "float"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "json"
  | "media"
  | "object"
  | "array"

export type MigrationAction = "add" | "remove" | "rename" | "change_type"

export interface MigrationChange {
  action: MigrationAction
  field?: string
  newField?: string
  fromType?: FieldType
  toType?: FieldType
  config?: Record<string, unknown>
  required?: boolean
}

export type MigrationSafety = "safe" | "risky" | "destructive"

export interface MigrationValidationResult {
  safe: MigrationChange[]
  risky: MigrationChange[]
  destructive: MigrationChange[]
}

// ─── Safe type transitions (auto-apply) ──────────────────────────────
// These are widening/lossless conversions
const SAFE_TRANSITIONS: Array<[FieldType, FieldType]> = [
  ["integer", "float"],
  ["text", "richtext"],
  ["date", "datetime"],
  // string → enum is safe only if all existing values match the enum;
  // we treat it as safe here (validation should be done at runtime)
  ["text", "enum"],
]

// ─── Risky type transitions (require user choice) ────────────────────
// These may lose data but can often be recovered
const RISKY_TRANSITIONS: Array<[FieldType, FieldType]> = [
  ["text", "number"],
  ["text", "integer"],
  ["text", "float"],
  ["text", "boolean"],
  ["text", "date"],
  ["text", "datetime"],
  ["enum", "text"],
  ["richtext", "text"],
  ["float", "integer"],
  ["number", "integer"],
]

// ─── Destructive transitions (block or warn) ─────────────────────────
// These will almost certainly lose data
const DESTRUCTIVE_TRANSITIONS: Array<[FieldType, FieldType]> = [
  ["object", "text"],
  ["array", "text"],
  ["json", "text"],
  ["object", "number"],
  ["array", "number"],
  ["json", "number"],
]

/**
 * Classify a single type change as safe, risky, or destructive.
 */
export function classifyTypeChange(
  fromType: FieldType,
  toType: FieldType
): MigrationSafety {
  if (fromType === toType) return "safe"

  for (const [from, to] of SAFE_TRANSITIONS) {
    if (from === fromType && to === toType) return "safe"
  }

  for (const [from, to] of RISKY_TRANSITIONS) {
    if (from === fromType && to === toType) return "risky"
  }

  for (const [from, to] of DESTRUCTIVE_TRANSITIONS) {
    if (from === fromType && to === toType) return "destructive"
  }

  // Unknown transitions default to risky
  return "risky"
}

/**
 * Classify a single migration change action.
 */
export function classifyChange(change: MigrationChange): MigrationSafety {
  switch (change.action) {
    case "add":
      // Adding a new field is always safe (unless required without default)
      return change.required ? "risky" : "safe"

    case "remove":
      // Removing a field is destructive if required, risky otherwise
      return change.required ? "destructive" : "destructive"

    case "rename":
      // Renaming without an alias mapping is risky
      return "risky"

    case "change_type":
      if (change.fromType && change.toType) {
        return classifyTypeChange(change.fromType, change.toType)
      }
      return "risky"

    default:
      return "risky"
  }
}

/**
 * Validate a set of migration changes and classify each one.
 */
export function validateMigrationChanges(
  changes: MigrationChange[]
): MigrationValidationResult {
  const result: MigrationValidationResult = {
    safe: [],
    risky: [],
    destructive: [],
  }

  for (const change of changes) {
    const safety = classifyChange(change)
    result[safety].push(change)
  }

  return result
}

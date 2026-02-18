/**
 * Schema diff engine.
 *
 * Compares two versions of a content type schema and returns a list
 * of classified changes (safe / risky / destructive).
 */

import type { SchemaField, SchemaChange, FieldType } from "./types"

// ─── Safe type transitions (auto-apply) ──────────────────────────────

const SAFE_TRANSITIONS = new Set<string>([
  "integer->float",
  "integer->number",
  "text->richtext",
  "text->email",
  "text->url",
  "date->datetime",
  "text->enum",
])

// ─── Risky type transitions (confirm) ────────────────────────────────

const RISKY_TRANSITIONS = new Set<string>([
  "text->number",
  "text->integer",
  "text->float",
  "text->boolean",
  "text->date",
  "text->datetime",
  "enum->text",
  "richtext->text",
  "float->integer",
  "number->integer",
  "email->text",
  "url->text",
])

// ─── Destructive type transitions (hold-to-confirm) ──────────────────

const DESTRUCTIVE_TRANSITIONS = new Set<string>([
  "json->text",
  "json->number",
  "repeater->text",
  "repeater->number",
  "repeater->json",
  "media->text",
  "relation->text",
  "richtext->boolean",
  "richtext->number",
  "richtext->integer",
  "text->password",
  "richtext->password",
  "json->boolean",
  "media->boolean",
  "relation->boolean",
  "repeater->boolean",
])

// ─── Classify a single type change ──────────────────────────────────

export function classifyTypeChange(
  from: FieldType,
  to: FieldType
): "safe" | "risky" | "destructive" {
  if (from === to) return "safe"
  const key = `${from}->${to}`
  if (SAFE_TRANSITIONS.has(key)) return "safe"
  if (DESTRUCTIVE_TRANSITIONS.has(key)) return "destructive"
  if (RISKY_TRANSITIONS.has(key)) return "risky"
  return "risky"
}

// ─── Human-readable warning message ──────────────────────────────────

function typeChangeWarning(
  field: string,
  from: FieldType,
  to: FieldType
): string {
  const labels: Partial<Record<FieldType, string>> = {
    text: "Text",
    richtext: "Rich Text",
    number: "Number",
    integer: "Integer",
    float: "Float",
    boolean: "Boolean",
    date: "Date",
    datetime: "Date & Time",
    enum: "Enum",
    json: "JSON",
    email: "Email",
    url: "URL",
    password: "Password",
    media: "Media",
    relation: "Relation",
    repeater: "Repeater",
  }
  return `Changing "${field}" from ${labels[from] ?? from} to ${labels[to] ?? to} may result in data loss.`
}

// ─── Diff two schema versions ────────────────────────────────────────

export function diffSchemas(
  oldFields: SchemaField[],
  newFields: SchemaField[]
): SchemaChange[] {
  const changes: SchemaChange[] = []

  const oldByUid = new Map(oldFields.map((f) => [f.uid, f]))
  const newByUid = new Map(newFields.map((f) => [f.uid, f]))

  // Removed fields
  for (const old of oldFields) {
    if (!newByUid.has(old.uid)) {
      changes.push({
        action: "remove",
        field: old.name,
        severity: "destructive",
        warning: `Removing field "${old.name}" will permanently delete all data stored in this field across all entries.`,
      })
    }
  }

  // Added fields
  for (const nf of newFields) {
    if (!oldByUid.has(nf.uid)) {
      changes.push({
        action: "add",
        field: nf.name,
        severity: nf.required ? "risky" : "safe",
        warning: nf.required
          ? `Adding required field "${nf.name}" — existing entries won\u2019t have a value for this field.`
          : undefined,
      })
    }
  }

  // Modified fields
  for (const nf of newFields) {
    const old = oldByUid.get(nf.uid)
    if (!old) continue

    if (old.type !== nf.type) {
      const severity = classifyTypeChange(old.type, nf.type)
      changes.push({
        action: "typeChange",
        field: nf.name,
        fromType: old.type,
        toType: nf.type,
        severity,
        warning: typeChangeWarning(nf.name, old.type, nf.type),
      })
    }

    if (JSON.stringify(old.validation) !== JSON.stringify(nf.validation)) {
      changes.push({
        action: "validationChange",
        field: nf.name,
        severity: "safe",
      })
    }

    if (JSON.stringify(old.config) !== JSON.stringify(nf.config)) {
      changes.push({
        action: "configChange",
        field: nf.name,
        severity: "safe",
      })
    }
  }

  // Reorder detection
  const newOrder = newFields
    .filter((f) => oldByUid.has(f.uid))
    .map((f) => f.uid)
    .join(",")
  const oldOrderFiltered = oldFields
    .filter((f) => newByUid.has(f.uid))
    .map((f) => f.uid)
    .join(",")

  if (oldOrderFiltered !== newOrder) {
    changes.push({
      action: "reorder",
      severity: "safe",
    })
  }

  return changes
}

// ─── Aggregate severity ──────────────────────────────────────────────

export function getMaxSeverity(
  changes: SchemaChange[]
): "safe" | "risky" | "destructive" {
  if (changes.some((c) => c.severity === "destructive")) return "destructive"
  if (changes.some((c) => c.severity === "risky")) return "risky"
  return "safe"
}

export function hasDestructiveChanges(changes: SchemaChange[]): boolean {
  return changes.some((c) => c.severity === "destructive")
}

export function hasRiskyChanges(changes: SchemaChange[]): boolean {
  return changes.some((c) => c.severity === "risky")
}

export function groupChangesBySeverity(changes: SchemaChange[]) {
  return {
    safe: changes.filter((c) => c.severity === "safe"),
    risky: changes.filter((c) => c.severity === "risky"),
    destructive: changes.filter((c) => c.severity === "destructive"),
  }
}

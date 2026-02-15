/**
 * Schema manipulation utilities for the visual schema builder.
 */

import type {
  SchemaField,
  ContentTypeSchema,
  FieldType,
  LegacySchema,
} from "./types"

// ─── UID generation ────────────────────────────────────────────────

let counter = 0

export function generateFieldUid(): string {
  counter += 1
  return `f_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// ─── Field name validation ─────────────────────────────────────────

const RESERVED_NAMES = new Set([
  "id",
  "uid",
  "slug",
  "status",
  "createdAt",
  "updatedAt",
  "organizationId",
  "contentTypeId",
])

const FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]*$/

export function validateFieldName(
  name: string,
  existingFields: SchemaField[],
  currentUid?: string
): string | null {
  if (!name.trim()) return "Name is required"
  if (!FIELD_NAME_PATTERN.test(name)) {
    return "Must start with a lowercase letter and only contain letters, numbers, and underscores"
  }
  if (RESERVED_NAMES.has(name)) {
    return `"${name}" is a reserved field name`
  }
  const duplicate = existingFields.find(
    (f) => f.name === name && f.uid !== currentUid
  )
  if (duplicate) {
    return `A field named "${name}" already exists`
  }
  return null
}

// ─── Schema field operations ───────────────────────────────────────

export function addField(
  fields: SchemaField[],
  field: SchemaField,
  position?: number
): SchemaField[] {
  const copy = [...fields]
  if (position !== undefined && position >= 0 && position <= copy.length) {
    copy.splice(position, 0, field)
  } else {
    copy.push(field)
  }
  return copy
}

export function updateField(
  fields: SchemaField[],
  uid: string,
  updates: Partial<SchemaField>
): SchemaField[] {
  return fields.map((f) => (f.uid === uid ? { ...f, ...updates } : f))
}

export function removeField(
  fields: SchemaField[],
  uid: string
): SchemaField[] {
  return fields.filter((f) => f.uid !== uid)
}

export function moveFieldUp(
  fields: SchemaField[],
  uid: string
): SchemaField[] {
  const idx = fields.findIndex((f) => f.uid === uid)
  if (idx <= 0) return fields
  const copy = [...fields]
  ;[copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]]
  return copy
}

export function moveFieldDown(
  fields: SchemaField[],
  uid: string
): SchemaField[] {
  const idx = fields.findIndex((f) => f.uid === uid)
  if (idx < 0 || idx >= fields.length - 1) return fields
  const copy = [...fields]
  ;[copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]]
  return copy
}

// ─── Create empty field template ───────────────────────────────────

export function createFieldTemplate(type: FieldType): SchemaField {
  const base: SchemaField = {
    uid: generateFieldUid(),
    name: "",
    type,
    required: false,
  }

  switch (type) {
    case "enum":
      base.config = { options: [] }
      break
    case "media":
      base.config = { mediaSource: "both", multiple: false }
      break
    case "relation":
      base.config = { relationTo: "", multiple: false }
      break
    case "repeater":
      base.config = { componentFields: [] }
      base.validation = {}
      break
  }

  return base
}

// ─── Schema format helpers ─────────────────────────────────────────

export function createEmptySchema(): ContentTypeSchema {
  return { version: 2, fields: [] }
}

export function toSchemaJson(fields: SchemaField[]): ContentTypeSchema {
  return { version: 2, fields }
}

// ─── Legacy detection & migration ──────────────────────────────────

export function isLegacySchema(schema: unknown): schema is LegacySchema {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return false
  }
  const s = schema as Record<string, unknown>
  if (s.version === 2 && Array.isArray(s.fields)) {
    return false
  }
  if (s.type === "object" && s.properties && typeof s.properties === "object") {
    return true
  }
  if (s.fields && typeof s.fields === "object" && !Array.isArray(s.fields)) {
    return true
  }
  return false
}

export function isV2Schema(schema: unknown): schema is ContentTypeSchema {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return false
  }
  const s = schema as Record<string, unknown>
  return s.version === 2 && Array.isArray(s.fields)
}

export function migrateLegacySchema(legacy: LegacySchema): ContentTypeSchema {
  const fields: SchemaField[] = []
  const props = legacy.properties || legacy.fields || {}
  const required = legacy.required || []

  for (const [name, prop] of Object.entries(props)) {
    fields.push({
      uid: generateFieldUid(),
      name,
      type: mapLegacyType(prop.type),
      label: name.charAt(0).toUpperCase() + name.slice(1),
      required: required.includes(name),
    })
  }

  return { version: 2, fields }
}

function mapLegacyType(type: string): FieldType {
  const map: Record<string, FieldType> = {
    string: "text",
    text: "text",
    richtext: "richtext",
    number: "number",
    integer: "integer",
    float: "float",
    boolean: "boolean",
    date: "date",
    datetime: "datetime",
    enum: "enum",
    json: "json",
    email: "email",
    url: "url",
    password: "password",
    media: "media",
    relation: "relation",
    repeater: "repeater",
    array: "json",
    object: "json",
  }
  return map[type] ?? "text"
}

// ─── Parse schema from DB (handles both formats) ──────────────────

export function parseSchemaFields(schema: unknown): SchemaField[] {
  if (isV2Schema(schema)) {
    return schema.fields
  }
  if (isLegacySchema(schema)) {
    return migrateLegacySchema(schema).fields
  }
  return []
}

// ─── Field display helpers ─────────────────────────────────────────

export function getFieldLabel(field: SchemaField): string {
  return (
    field.label ||
    field.name.charAt(0).toUpperCase() +
      field.name.slice(1).replace(/([A-Z])/g, " $1")
  )
}

export function getFieldSummary(field: SchemaField): string {
  const parts: string[] = [field.type]
  if (field.required) parts.push("required")
  if (field.validation?.minLength) parts.push(`min:${field.validation.minLength}`)
  if (field.validation?.maxLength) parts.push(`max:${field.validation.maxLength}`)
  if (field.validation?.min !== undefined) parts.push(`min:${field.validation.min}`)
  if (field.validation?.max !== undefined) parts.push(`max:${field.validation.max}`)
  if (field.config?.options?.length) parts.push(`${field.config.options.length} options`)
  if (field.config?.multiple) parts.push("multiple")
  if (field.config?.relationTo) parts.push(`\u2192 ${field.config.relationTo}`)
  if (field.config?.componentFields?.length) {
    parts.push(`${field.config.componentFields.length} sub-fields`)
  }
  return parts.join(" \u00b7 ")
}

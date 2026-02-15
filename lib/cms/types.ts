/**
 * CMS Schema Type Definitions
 *
 * Used by the visual schema builder, entry editor, and schema
 * migration system.
 */

// ─── Field types ───────────────────────────────────────────────────

export type FieldType =
  | "text"
  | "richtext"
  | "number"
  | "integer"
  | "float"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "json"
  | "email"
  | "url"
  | "password"
  | "media"
  | "relation"
  | "repeater"

export const FIELD_TYPES: FieldType[] = [
  "text",
  "richtext",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "datetime",
  "enum",
  "email",
  "url",
  "password",
  "json",
  "media",
  "relation",
  "repeater",
]

export interface FieldTypeMeta {
  type: FieldType
  label: string
  description: string
  category: "basic" | "advanced" | "relational"
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  text: { type: "text", label: "Text", description: "Single-line text input", category: "basic" },
  richtext: { type: "richtext", label: "Rich Text", description: "Multi-line text with formatting", category: "basic" },
  number: { type: "number", label: "Number", description: "Numeric value (decimal)", category: "basic" },
  integer: { type: "integer", label: "Integer", description: "Whole number", category: "basic" },
  float: { type: "float", label: "Float", description: "Floating-point number", category: "basic" },
  boolean: { type: "boolean", label: "Boolean", description: "True / false toggle", category: "basic" },
  date: { type: "date", label: "Date", description: "Date picker", category: "basic" },
  datetime: { type: "datetime", label: "Date & Time", description: "Date and time picker", category: "basic" },
  enum: { type: "enum", label: "Enum", description: "Dropdown selection from options", category: "basic" },
  email: { type: "email", label: "Email", description: "Email address field", category: "advanced" },
  url: { type: "url", label: "URL", description: "Web URL field", category: "advanced" },
  password: { type: "password", label: "Password", description: "Password (hidden input)", category: "advanced" },
  json: { type: "json", label: "JSON", description: "Freeform JSON data", category: "advanced" },
  media: { type: "media", label: "Media", description: "Image, video, or file upload", category: "relational" },
  relation: { type: "relation", label: "Relation", description: "Link to another content type", category: "relational" },
  repeater: { type: "repeater", label: "Repeater", description: "Repeatable field group", category: "relational" },
}

// ─── Schema field shape ────────────────────────────────────────────

export interface SchemaFieldValidation {
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  minDate?: string
  maxDate?: string
  minItems?: number
  maxItems?: number
}

export interface SchemaFieldConfig {
  options?: string[]
  allowedMimeTypes?: string[]
  maxSizeMB?: number
  multiple?: boolean
  mediaSource?: "assets" | "cms" | "both"
  relationTo?: string
  componentFields?: SchemaField[]
}

export interface SchemaField {
  uid: string
  name: string
  type: FieldType
  label?: string
  placeholder?: string
  description?: string
  required?: boolean
  default?: unknown
  validation?: SchemaFieldValidation
  config?: SchemaFieldConfig
}

// ─── Content type schema (v2 format) ──────────────────────────────

export interface ContentTypeSchema {
  version: 2
  fields: SchemaField[]
}

// ─── Legacy format ────────────────────────────────────────────────

export interface LegacySchemaProperty {
  type: string
  [key: string]: unknown
}

export interface LegacySchema {
  type?: "object"
  properties?: Record<string, LegacySchemaProperty>
  required?: string[]
  fields?: Record<string, LegacySchemaProperty>
}

// ─── Schema change (for diff / migration) ──────────────────────────

export type SchemaChangeAction =
  | "add"
  | "remove"
  | "typeChange"
  | "validationChange"
  | "configChange"
  | "reorder"

export interface SchemaChange {
  action: SchemaChangeAction
  field?: string
  fromType?: FieldType
  toType?: FieldType
  severity: "safe" | "risky" | "destructive"
  warning?: string
}

import { z } from "zod"
import type { SchemaField, SchemaFieldValidation, FieldType } from "./types"

export type EntryValidationResult = {
  success: boolean
  errors: Record<string, string>
}

export function getFieldRequirements(field: SchemaField): string[] {
  const requirements: string[] = []
  const { type, required, validation } = field

  if (required) {
    requirements.push("Required")
  }

  switch (type) {
    case "text":
    case "richtext":
    case "password":
    case "email":
    case "url":
      if (validation?.minLength !== undefined) {
        requirements.push(`Min ${validation.minLength} characters`)
      }
      if (validation?.maxLength !== undefined) {
        requirements.push(`Max ${validation.maxLength} characters`)
      }
      if (validation?.pattern) {
        requirements.push("Must match pattern")
      }
      if (type === "email") {
        requirements.push("Valid email format")
      }
      if (type === "url") {
        requirements.push("Valid URL")
      }
      break

    case "number":
    case "float":
      if (validation?.min !== undefined) {
        requirements.push(`Min: ${validation.min}`)
      }
      if (validation?.max !== undefined) {
        requirements.push(`Max: ${validation.max}`)
      }
      break

    case "integer":
      requirements.push("Whole number")
      if (validation?.min !== undefined) {
        requirements.push(`Min: ${validation.min}`)
      }
      if (validation?.max !== undefined) {
        requirements.push(`Max: ${validation.max}`)
      }
      break

    case "date":
    case "datetime":
      if (validation?.minDate) {
        requirements.push(`From ${validation.minDate}`)
      }
      if (validation?.maxDate) {
        requirements.push(`Until ${validation.maxDate}`)
      }
      break

    case "enum":
      const options = field.config?.options ?? []
      if (options.length > 0) {
        requirements.push(`Options: ${options.slice(0, 3).join(", ")}${options.length > 3 ? "..." : ""}`)
      }
      break

    case "json":
      requirements.push("Valid JSON")
      break

    case "media":
    case "relation":
    case "repeater":
      if (validation?.minItems !== undefined) {
        requirements.push(`Min ${validation.minItems} items`)
      }
      if (validation?.maxItems !== undefined) {
        requirements.push(`Max ${validation.maxItems} items`)
      }
      if (field.config?.multiple) {
        requirements.push("Multiple allowed")
      }
      if (type === "media" && field.config?.allowedMimeTypes?.length) {
        requirements.push(`Types: ${field.config.allowedMimeTypes.slice(0, 2).join(", ")}`)
      }
      break
  }

  return requirements
}

export function buildZodSchema(fields: SchemaField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    shape[field.name] = buildFieldSchema(field)
  }

  return z.object(shape)
}

export function buildFieldSchema(field: SchemaField): z.ZodTypeAny {
  const { type, required, validation } = field
  let schema: z.ZodTypeAny

  switch (type) {
    case "text":
    case "richtext":
    case "password":
      schema = buildTextSchema(validation)
      break

    case "email":
      schema = buildEmailSchema(validation)
      break

    case "url":
      schema = buildUrlSchema(validation)
      break

    case "number":
    case "float":
      schema = buildNumberSchema(validation)
      break

    case "integer":
      schema = buildIntegerSchema(validation)
      break

    case "boolean":
      schema = z.boolean()
      break

    case "date":
    case "datetime":
      schema = buildDateSchema(validation)
      break

    case "enum":
      schema = buildEnumSchema(field.config?.options ?? [], validation)
      break

    case "json":
      schema = buildJsonSchema()
      break

    case "media":
      schema = buildMediaSchema(field.config?.multiple, validation)
      break

    case "relation":
      schema = buildRelationSchema(field.config?.multiple, validation)
      break

    case "repeater":
      schema = buildRepeaterSchema(field.config?.componentFields ?? [], validation)
      break

    default:
      schema = z.any()
  }

  if (required) {
    if (type === "boolean") {
      // Boolean is always required, no refinement needed
    } else if (schema instanceof z.ZodString) {
      schema = schema.min(1, "This field is required")
    } else if (schema instanceof z.ZodNumber) {
      // Numbers can be optional, but if required we need to check they exist
      schema = schema.refine((val) => val !== null && val !== undefined, {
        message: "This field is required",
      })
    } else if (schema instanceof z.ZodArray) {
      schema = schema.min(1, "At least one item is required")
    } else if (schema instanceof z.ZodObject || schema instanceof z.ZodRecord) {
      // Already handled
    } else {
      schema = schema.refine((val) => val !== null && val !== undefined && val !== "", {
        message: "This field is required",
      })
    }
  } else {
    schema = schema.optional().nullable()
  }

  return schema
}

function buildTextSchema(validation?: SchemaFieldValidation): z.ZodString {
  let schema = z.string()

  if (validation?.minLength !== undefined) {
    schema = schema.min(validation.minLength, `Must be at least ${validation.minLength} characters`)
  }
  if (validation?.maxLength !== undefined) {
    schema = schema.max(validation.maxLength, `Must be at most ${validation.maxLength} characters`)
  }
  if (validation?.pattern) {
    try {
      const regex = new RegExp(validation.pattern)
      schema = schema.regex(regex, "Invalid format")
    } catch {
      // Invalid regex, skip
    }
  }

  return schema
}

function buildEmailSchema(validation?: SchemaFieldValidation): z.ZodString {
  let schema = z.string().email("Invalid email address")

  if (validation?.minLength !== undefined) {
    schema = schema.min(validation.minLength, `Must be at least ${validation.minLength} characters`)
  }
  if (validation?.maxLength !== undefined) {
    schema = schema.max(validation.maxLength, `Must be at most ${validation.maxLength} characters`)
  }

  return schema
}

function buildUrlSchema(validation?: SchemaFieldValidation): z.ZodString {
  let schema = z.string().url("Invalid URL")

  if (validation?.minLength !== undefined) {
    schema = schema.min(validation.minLength, `Must be at least ${validation.minLength} characters`)
  }
  if (validation?.maxLength !== undefined) {
    schema = schema.max(validation.maxLength, `Must be at most ${validation.maxLength} characters`)
  }

  return schema
}

function buildNumberSchema(validation?: SchemaFieldValidation): z.ZodNumber {
  let schema = z.number()

  if (validation?.min !== undefined) {
    schema = schema.min(validation.min, `Must be at least ${validation.min}`)
  }
  if (validation?.max !== undefined) {
    schema = schema.max(validation.max, `Must be at most ${validation.max}`)
  }

  return schema
}

function buildIntegerSchema(validation?: SchemaFieldValidation): z.ZodNumber {
  let schema = z.number().int("Must be a whole number")

  if (validation?.min !== undefined) {
    schema = schema.min(validation.min, `Must be at least ${validation.min}`)
  }
  if (validation?.max !== undefined) {
    schema = schema.max(validation.max, `Must be at most ${validation.max}`)
  }

  return schema
}

function buildDateSchema(validation?: SchemaFieldValidation): z.ZodString {
  let schema = z.string()

  // Basic date format validation could be added here
  // For now we just accept any string (HTML date inputs handle format)

  if (validation?.minDate) {
    schema = schema.refine((val) => !val || val >= validation.minDate!, {
      message: `Date must be on or after ${validation.minDate}`,
    })
  }
  if (validation?.maxDate) {
    schema = schema.refine((val) => !val || val <= validation.maxDate!, {
      message: `Date must be on or before ${validation.maxDate}`,
    })
  }

  return schema
}

function buildEnumSchema(options: string[], validation?: SchemaFieldValidation): z.ZodString {
  if (options.length === 0) {
    return z.string()
  }

  let schema = z.enum(options as [string, ...string[]])

  // Handle minLength/maxLength for enums? Usually not needed
  // But we can support them as string constraints

  return schema as unknown as z.ZodString
}

function buildJsonSchema(): z.ZodType {
  return z.any().refine(
    (val) => {
      if (val === null || val === undefined || val === "") return true
      if (typeof val === "object") return true
      if (typeof val === "string") {
        try {
          JSON.parse(val)
          return true
        } catch {
          return false
        }
      }
      return false
    },
    { message: "Invalid JSON" }
  )
}

function buildMediaSchema(multiple?: boolean, validation?: SchemaFieldValidation): z.ZodTypeAny {
  if (multiple) {
    let schema = z.array(z.string().url("Invalid media URL"))
    if (validation?.minItems !== undefined) {
      schema = schema.min(validation.minItems, `Must have at least ${validation.minItems} items`)
    }
    if (validation?.maxItems !== undefined) {
      schema = schema.max(validation.maxItems, `Must have at most ${validation.maxItems} items`)
    }
    return schema
  }
  return z.string().url("Invalid media URL").nullable()
}

function buildRelationSchema(multiple?: boolean, validation?: SchemaFieldValidation): z.ZodTypeAny {
  if (multiple) {
    let schema = z.array(z.string())
    if (validation?.minItems !== undefined) {
      schema = schema.min(validation.minItems, `Must have at least ${validation.minItems} items`)
    }
    if (validation?.maxItems !== undefined) {
      schema = schema.max(validation.maxItems, `Must have at most ${validation.maxItems} items`)
    }
    return schema
  }
  return z.string().nullable()
}

function buildRepeaterSchema(
  componentFields: SchemaField[],
  validation?: SchemaFieldValidation
): z.ZodTypeAny {
  const itemSchema = buildZodSchema(componentFields)
  let schema = z.array(itemSchema)

  if (validation?.minItems !== undefined) {
    schema = schema.min(validation.minItems, `Must have at least ${validation.minItems} items`)
  }
  if (validation?.maxItems !== undefined) {
    schema = schema.max(validation.maxItems, `Must have at most ${validation.maxItems} items`)
  }

  return schema
}

export function validateEntryData(
  fields: SchemaField[],
  data: Record<string, unknown>
): EntryValidationResult {
  const schema = buildZodSchema(fields)
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, errors: {} }
  }

  const errors: Record<string, string> = {}

  for (const issue of result.error.issues) {
    const path = issue.path.join(".")
    if (!errors[path]) {
      errors[path] = issue.message
    }
  }

  return { success: false, errors }
}

export function coerceFieldValues(
  fields: SchemaField[],
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const field of fields) {
    const value = data[field.name]

    if (value === undefined || value === null || value === "") {
      if (field.required) {
        result[field.name] = undefined
      } else {
        result[field.name] = null
      }
      continue
    }

    switch (field.type) {
      case "number":
      case "integer":
      case "float":
        const num = Number(value)
        result[field.name] = isNaN(num) ? null : num
        break

      case "boolean":
        result[field.name] = Boolean(value)
        break

      case "json":
        if (typeof value === "string" && value.trim()) {
          try {
            result[field.name] = JSON.parse(value)
          } catch {
            result[field.name] = value
          }
        } else {
          result[field.name] = value
        }
        break

      default:
        result[field.name] = value
    }
  }

  return result
}

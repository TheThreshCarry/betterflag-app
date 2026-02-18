"use client"

import { useState, useCallback } from "react"
import type {
  SchemaField,
  FieldType,
  SchemaFieldValidation,
  SchemaFieldConfig,
} from "@/lib/cms/types"
import { FIELD_TYPE_META, FIELD_TYPES } from "@/lib/cms/types"
import { validateFieldName, generateFieldUid } from "@/lib/cms/schema-utils"
import { FieldTypeIcon } from "./field-type-icon"
import { FieldValidationEditor } from "./field-validation-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus, X } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^([A-Z])/, (m) => m.toLowerCase())
    .replace(/_([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
}

const NO_DEFAULT_TYPES: FieldType[] = [
  "media",
  "relation",
  "repeater",
  "password",
]

const REPEATER_ALLOWED_TYPES: FieldType[] = FIELD_TYPES.filter(
  (t) => t !== "repeater"
)

// ─── Sub-field editor (simplified, used inside repeater config) ───

interface SubFieldEditorProps {
  field: SchemaField
  existingFields: SchemaField[]
  onSave: (field: SchemaField) => void
  onCancel: () => void
}

function SubFieldEditor({
  field,
  existingFields,
  onSave,
  onCancel,
}: SubFieldEditorProps) {
  const [name, setName] = useState(field.name)
  const [type, setType] = useState<FieldType>(field.type)
  const [required, setRequired] = useState(field.required ?? false)
  const [label, setLabel] = useState(field.label ?? "")

  const nameError = validateFieldName(name, existingFields, field.uid)

  return (
    <div className="rounded-md border p-3 flex flex-col gap-2 bg-muted/30">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Name *</Label>
        <Input
          value={name}
          placeholder="fieldName"
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
        />
        {nameError && (
          <p className="text-xs text-destructive">{nameError}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Label</Label>
        <Input
          value={label}
          placeholder="Display label"
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPEATER_ALLOWED_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                <span className="flex items-center gap-2">
                  <FieldTypeIcon type={t} className="h-3.5 w-3.5" />
                  {FIELD_TYPE_META[t].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={required}
          onCheckedChange={setRequired}
          id="sub-required"
        />
        <Label htmlFor="sub-required" className="text-xs">
          Required
        </Label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSave({
              ...field,
              name,
              type,
              label: label || undefined,
              required,
            })
          }
          disabled={!!nameError}
          className="h-7 text-xs"
        >
          OK
        </Button>
      </div>
    </div>
  )
}

// ─── Enum options dynamic input ────────────────────────────────────

interface EnumOptionsEditorProps {
  options: string[]
  onChange: (options: string[]) => void
}

function EnumOptionsEditor({ options, onChange }: EnumOptionsEditorProps) {
  const handleAdd = () => {
    onChange([...options, ""])
  }

  const handleUpdate = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    onChange(updated)
  }

  const handleRemove = (index: number) => {
    onChange(options.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault()
      // If we're on the last option and it's not empty, add a new one
      if (index === options.length - 1 && options[index].trim()) {
        handleAdd()
        // Focus the new input on next tick
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLInputElement>(
            "[data-enum-option-input]"
          )
          inputs[inputs.length - 1]?.focus()
        }, 0)
      }
    }
    if (e.key === "Backspace" && options[index] === "" && options.length > 1) {
      e.preventDefault()
      handleRemove(index)
      // Focus previous input
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>(
          "[data-enum-option-input]"
        )
        inputs[Math.max(0, index - 1)]?.focus()
      }, 0)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Options</Label>

      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No options yet. Add your first option below.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground tabular-nums w-5 text-right shrink-0">
              {index + 1}.
            </span>
            <Input
              data-enum-option-input
              value={option}
              placeholder={`Option ${index + 1}`}
              onChange={(e) => handleUpdate(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="h-8 text-sm"
              autoFocus={option === "" && index === options.length - 1}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(index)}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Remove option {index + 1}</span>
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={handleAdd}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Option
      </Button>
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────

interface SchemaFieldEditorProps {
  field: SchemaField
  existingFields: SchemaField[]
  contentTypes?: Array<{ id: string; name: string; slug: string }>
  isNew: boolean
  onSave: (field: SchemaField) => void
  onCancel: () => void
}

export function SchemaFieldEditor({
  field,
  existingFields,
  contentTypes,
  isNew,
  onSave,
  onCancel,
}: SchemaFieldEditorProps) {
  // ── Local state ────────────────────────────────────────────────
  const [name, setName] = useState(field.name)
  const [label, setLabel] = useState(field.label ?? "")
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? "")
  const [description, setDescription] = useState(field.description ?? "")
  const [required, setRequired] = useState(field.required ?? false)
  const [validation, setValidation] = useState<SchemaFieldValidation>(
    field.validation ?? {}
  )
  const [config, setConfig] = useState<SchemaFieldConfig>(field.config ?? {})
  const [defaultValue, setDefaultValue] = useState<unknown>(
    field.default ?? undefined
  )

  // Repeater sub-field editor state
  const [editingSubField, setEditingSubField] = useState<SchemaField | null>(
    null
  )

  // Track whether the user has manually edited the name
  const [nameManuallySet, setNameManuallySet] = useState(field.name !== "")

  const type = field.type

  // ── Name auto-slug from label ──────────────────────────────────
  const handleLabelChange = useCallback(
    (val: string) => {
      setLabel(val)
      if (!nameManuallySet) {
        setName(slugify(val))
      }
    },
    [nameManuallySet]
  )

  const handleNameChange = useCallback((val: string) => {
    setName(val)
    setNameManuallySet(true)
  }, [])

  // ── Validation ─────────────────────────────────────────────────
  const nameError = validateFieldName(name, existingFields, field.uid)
  const canSave = !nameError

  // ── Build final field on save ──────────────────────────────────
  const handleSave = () => {
    const updated: SchemaField = {
      ...field,
      name,
      label: label || undefined,
      placeholder: placeholder || undefined,
      description: description || undefined,
      required,
      validation:
        Object.keys(validation).length > 0 ? validation : undefined,
      config: Object.keys(config).length > 0 ? config : undefined,
      default: defaultValue,
    }
    onSave(updated)
  }

  // ── Config helpers ─────────────────────────────────────────────
  const patchConfig = (patch: Partial<SchemaFieldConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }))

  // ── Repeater sub-field operations ──────────────────────────────
  const componentFields = config.componentFields ?? []

  const addSubField = () => {
    setEditingSubField({
      uid: generateFieldUid(),
      name: "",
      type: "text",
      required: false,
    })
  }

  const saveSubField = (sf: SchemaField) => {
    const existing = componentFields.find((f) => f.uid === sf.uid)
    if (existing) {
      patchConfig({
        componentFields: componentFields.map((f) =>
          f.uid === sf.uid ? sf : f
        ),
      })
    } else {
      patchConfig({ componentFields: [...componentFields, sf] })
    }
    setEditingSubField(null)
  }

  const removeSubField = (uid: string) => {
    patchConfig({
      componentFields: componentFields.filter((f) => f.uid !== uid),
    })
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Type indicator */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <FieldTypeIcon type={type} className="h-4 w-4" />
        <span className="text-xs">{FIELD_TYPE_META[type].label}</span>
      </div>

      {/* ─── Basic ──────────────────────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Basic
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            value={name}
            placeholder="fieldName"
            onChange={(e) => handleNameChange(e.target.value)}
          />
          {nameError && (
            <p className="text-xs text-destructive">{nameError}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Label</Label>
          <Input
            value={label}
            placeholder="Display label"
            onChange={(e) => handleLabelChange(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={placeholder}
            placeholder="Input placeholder text"
            onChange={(e) => setPlaceholder(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Description</Label>
          <Input
            value={description}
            placeholder="Help text for this field"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={required}
            onCheckedChange={setRequired}
            id="field-required"
          />
          <Label htmlFor="field-required" className="text-xs">
            Required
          </Label>
        </div>
      </div>

      <Separator />

      {/* ─── Validation ─────────────────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Validation
      </p>

      <FieldValidationEditor
        type={type}
        validation={validation}
        onChange={setValidation}
      />

      <Separator />

      {/* ─── Type-Specific Config ───────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Type-Specific Config
      </p>

      {/* Enum */}
      {type === "enum" && (
        <EnumOptionsEditor
          options={config.options ?? []}
          onChange={(options) => patchConfig({ options })}
        />
      )}

      {/* Media */}
      {type === "media" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Source</Label>
            <Select
              value={config.mediaSource ?? "both"}
              onValueChange={(v) =>
                patchConfig({
                  mediaSource: v as "assets" | "cms" | "both",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assets">Assets</SelectItem>
                <SelectItem value="cms">CMS</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              Allowed Types (comma-separated)
            </Label>
            <Input
              value={(config.allowedMimeTypes ?? []).join(", ")}
              placeholder="image/*,video/*,.pdf"
              onChange={(e) =>
                patchConfig({
                  allowedMimeTypes: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Max Size MB</Label>
            <Input
              type="number"
              min={0}
              placeholder="No limit"
              value={config.maxSizeMB ?? ""}
              onChange={(e) =>
                patchConfig({
                  maxSizeMB: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={config.multiple ?? false}
              onCheckedChange={(v) => patchConfig({ multiple: v })}
              id="media-multiple"
            />
            <Label htmlFor="media-multiple" className="text-xs">
              Multiple
            </Label>
          </div>
        </div>
      )}

      {/* Relation */}
      {type === "relation" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Content Type</Label>
            {(!contentTypes || contentTypes.length === 0) ? (
              <p className="text-xs text-muted-foreground">
                No content types available. Create a content type first.
              </p>
            ) : (
              <Select
                value={config.relationTo ?? undefined}
                onValueChange={(v) => patchConfig({ relationTo: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map((ct) => (
                    <SelectItem key={ct.id} value={ct.slug}>
                      {ct.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={config.multiple ?? false}
              onCheckedChange={(v) => patchConfig({ multiple: v })}
              id="relation-multiple"
            />
            <Label htmlFor="relation-multiple" className="text-xs">
              Multiple
            </Label>
          </div>
        </div>
      )}

      {/* Repeater */}
      {type === "repeater" && (
        <div className="flex flex-col gap-3">
          <Label className="text-xs">Sub-Fields</Label>

          {componentFields.length === 0 && !editingSubField && (
            <p className="text-xs text-muted-foreground">
              No sub-fields yet. Add one below.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {componentFields.map((sf) => (
              <div
                key={sf.uid}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <FieldTypeIcon
                    type={sf.type}
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                  <span className="text-sm font-medium">{sf.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {sf.type}
                  </span>
                  {sf.required && (
                    <span className="text-[10px] text-destructive">*</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setEditingSubField(sf)}
                  >
                    <span className="sr-only">Edit</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeSubField(sf.uid)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {editingSubField && (
            <SubFieldEditor
              field={editingSubField}
              existingFields={componentFields.filter(
                (f) => f.uid !== editingSubField.uid
              )}
              onSave={saveSubField}
              onCancel={() => setEditingSubField(null)}
            />
          )}

          {!editingSubField && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={addSubField}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Sub-Field
            </Button>
          )}
        </div>
      )}

      {/* Types with no special config */}
      {!["enum", "media", "relation", "repeater"].includes(type) && (
        <p className="text-xs text-muted-foreground">
          No additional configuration for this type.
        </p>
      )}

      {/* ─── Default Value ──────────────────────────────────────── */}
      {!NO_DEFAULT_TYPES.includes(type) && (
        <>
          <Separator />

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Default Value
          </p>

          {/* Text-like */}
          {(type === "text" ||
            type === "richtext" ||
            type === "email" ||
            type === "url") && (
            <Input
              value={(defaultValue as string) ?? ""}
              placeholder="Default value"
              onChange={(e) =>
                setDefaultValue(e.target.value || undefined)
              }
            />
          )}

          {/* Numeric */}
          {(type === "number" ||
            type === "integer" ||
            type === "float") && (
            <Input
              type="number"
              value={(defaultValue as number) ?? ""}
              placeholder="Default value"
              onChange={(e) =>
                setDefaultValue(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          )}

          {/* Boolean */}
          {type === "boolean" && (
            <div className="flex items-center gap-2">
              <Switch
                checked={(defaultValue as boolean) ?? false}
                onCheckedChange={(v) => setDefaultValue(v)}
                id="default-bool"
              />
              <Label htmlFor="default-bool" className="text-xs">
                Default is {(defaultValue as boolean) ? "true" : "false"}
              </Label>
            </div>
          )}

          {/* Date / Datetime */}
          {(type === "date" || type === "datetime") && (
            <Input
              type={type === "datetime" ? "datetime-local" : "date"}
              value={(defaultValue as string) ?? ""}
              onChange={(e) =>
                setDefaultValue(e.target.value || undefined)
              }
            />
          )}

          {/* Enum */}
          {type === "enum" && (() => {
            const validOptions = (config.options ?? []).filter(opt => opt.trim().length > 0)
            return validOptions.length === 0 ? null : (
              <Select
                value={(defaultValue as string) ?? undefined}
                onValueChange={(v) => setDefaultValue(v || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  {validOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })()}

          {/* JSON */}
          {type === "json" && (
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="{}"
              value={
                typeof defaultValue === "string"
                  ? defaultValue
                  : defaultValue !== undefined
                    ? JSON.stringify(defaultValue, null, 2)
                    : ""
              }
              onChange={(e) =>
                setDefaultValue(e.target.value || undefined)
              }
            />
          )}
        </>
      )}

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <Separator />

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {isNew ? "Add Field" : "Save Field"}
        </Button>
      </div>
    </div>
  )
}

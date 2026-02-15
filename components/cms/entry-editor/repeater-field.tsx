"use client"

import { useCallback } from "react"
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { SchemaField } from "@/lib/cms/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepeaterFieldProps {
  value: unknown
  onChange: (value: unknown) => void
  componentFields: SchemaField[]
  label: string
  description?: string
  validation?: {
    minItems?: number
    maxItems?: number
  }
  error?: string
  showValidation?: boolean
  requirements?: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ItemRecord = Record<string, unknown>

function normalizeItems(value: unknown): ItemRecord[] {
  if (Array.isArray(value)) return value as ItemRecord[]
  return []
}

function buildEmptyItem(fields: SchemaField[]): ItemRecord {
  const item: ItemRecord = {}
  for (const f of fields) {
    if (f.default !== undefined) {
      item[f.name] = f.default
    } else if (f.type === "boolean") {
      item[f.name] = false
    } else if (f.type === "number" || f.type === "integer" || f.type === "float") {
      item[f.name] = ""
    } else {
      item[f.name] = ""
    }
  }
  return item
}

// ---------------------------------------------------------------------------
// Per-field renderer
// ---------------------------------------------------------------------------

function renderField(
  field: SchemaField,
  fieldValue: unknown,
  onFieldChange: (name: string, val: unknown) => void,
) {
  const id = `repeater-${field.uid}`
  const strValue = fieldValue != null ? String(fieldValue) : ""

  switch (field.type) {
    // ---- boolean ----
    case "boolean":
      return (
        <div key={field.uid} className="flex items-center gap-2">
          <Switch
            id={id}
            checked={!!fieldValue}
            onCheckedChange={(checked) => onFieldChange(field.name, checked)}
          />
          <Label htmlFor={id} className="text-sm font-normal">
            {field.label ?? field.name}
          </Label>
        </div>
      )

    // ---- richtext ----
    case "richtext":
      return (
        <div key={field.uid} className="space-y-1">
          <Label htmlFor={id}>{field.label ?? field.name}</Label>
          <Textarea
            id={id}
            placeholder={field.placeholder}
            value={strValue}
            onChange={(e) => onFieldChange(field.name, e.target.value)}
            rows={4}
          />
        </div>
      )

    // ---- enum ----
    case "enum":
      if (field.config?.options && field.config.options.length > 0) {
        return (
          <div key={field.uid} className="space-y-1">
            <Label htmlFor={id}>{field.label ?? field.name}</Label>
            <Select
              value={strValue}
              onValueChange={(v) => onFieldChange(field.name, v)}
            >
              <SelectTrigger id={id}>
                <SelectValue placeholder={field.placeholder ?? "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {field.config.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      }
      // fallthrough: no options defined, render text input
      return (
        <div key={field.uid} className="space-y-1">
          <Label htmlFor={id}>{field.label ?? field.name}</Label>
          <Input
            id={id}
            placeholder={field.placeholder}
            value={strValue}
            onChange={(e) => onFieldChange(field.name, e.target.value)}
          />
        </div>
      )

    // ---- number / integer / float ----
    case "number":
    case "integer":
    case "float":
      return (
        <div key={field.uid} className="space-y-1">
          <Label htmlFor={id}>{field.label ?? field.name}</Label>
          <Input
            id={id}
            type="number"
            step={field.type === "integer" ? "1" : "any"}
            placeholder={field.placeholder}
            value={strValue}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === "") {
                onFieldChange(field.name, "")
              } else {
                onFieldChange(
                  field.name,
                  field.type === "integer" ? parseInt(raw, 10) : parseFloat(raw),
                )
              }
            }}
          />
        </div>
      )

    // ---- date / datetime ----
    case "date":
      return (
        <div key={field.uid} className="space-y-1">
          <Label htmlFor={id}>{field.label ?? field.name}</Label>
          <Input
            id={id}
            type="date"
            value={strValue}
            onChange={(e) => onFieldChange(field.name, e.target.value)}
          />
        </div>
      )

    case "datetime":
      return (
        <div key={field.uid} className="space-y-1">
          <Label htmlFor={id}>{field.label ?? field.name}</Label>
          <Input
            id={id}
            type="datetime-local"
            value={strValue}
            onChange={(e) => onFieldChange(field.name, e.target.value)}
          />
        </div>
      )

    // ---- text, email, url, password, and everything else ----
    default: {
      const inputType =
        field.type === "email"
          ? "email"
          : field.type === "url"
            ? "url"
            : field.type === "password"
              ? "password"
              : "text"

      return (
        <div key={field.uid} className="space-y-1">
          <Label htmlFor={id}>{field.label ?? field.name}</Label>
          <Input
            id={id}
            type={inputType}
            placeholder={field.placeholder}
            value={strValue}
            onChange={(e) => onFieldChange(field.name, e.target.value)}
          />
        </div>
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RepeaterField({
  value,
  onChange,
  componentFields,
  label,
  description,
  validation,
  error,
  showValidation,
  requirements = [],
}: RepeaterFieldProps) {
  const items = normalizeItems(value)
  const maxItems = validation?.maxItems
  const minItems = validation?.minItems
  const canAdd = maxItems == null || items.length < maxItems
  const canRemove = minItems == null || items.length > minItems
  const hasError = showValidation && error

  // ------- actions -------

  const updateItems = useCallback(
    (next: ItemRecord[]) => onChange(next.length === 0 ? [] : next),
    [onChange],
  )

  function addItem() {
    if (!canAdd) return
    updateItems([...items, buildEmptyItem(componentFields)])
  }

  function removeItem(index: number) {
    if (!canRemove) return
    updateItems(items.filter((_, i) => i !== index))
  }

  function moveItem(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateItems(next)
  }

  function updateField(index: number, fieldName: string, fieldValue: unknown) {
    const next = items.map((item, i) =>
      i === index ? { ...item, [fieldName]: fieldValue } : item,
    )
    updateItems(next)
  }

  // ------- render -------

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </Label>

        {maxItems != null && (
          <span className="text-xs text-muted-foreground">
            {items.length} / {maxItems}
          </span>
        )}
      </div>

      {hasError ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {description}
          {requirements.length > 0 && (
            <span className="text-muted-foreground/70"> [{requirements.join(" • ")}]</span>
          )}
        </p>
      )}

      {/* Items */}
      {items.map((item, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-2">
            <span className="text-sm font-medium">Item {index + 1}</span>

            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => moveItem(index, "up")}
              >
                <ChevronUp className="h-4 w-4" />
                <span className="sr-only">Move up</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, "down")}
              >
                <ChevronDown className="h-4 w-4" />
                <span className="sr-only">Move down</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={!canRemove}
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete item</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 px-4 pb-4 pt-0">
            {componentFields.map((field) =>
              renderField(field, item[field.name], (name, val) =>
                updateField(index, name, val),
              ),
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={!canAdd}
        onClick={addItem}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add Item
      </Button>
    </div>
  )
}

"use client"

import type { FieldType, SchemaFieldValidation } from "@/lib/cms/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FieldValidationEditorProps {
  type: FieldType
  validation: SchemaFieldValidation
  onChange: (validation: SchemaFieldValidation) => void
}

function numOrUndef(value: string): number | undefined {
  if (value === "") return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

export function FieldValidationEditor({
  type,
  validation,
  onChange,
}: FieldValidationEditorProps) {
  const set = (patch: Partial<SchemaFieldValidation>) =>
    onChange({ ...validation, ...patch })

  // ── Text-like types ──────────────────────────────────────────────
  if (
    type === "text" ||
    type === "richtext" ||
    type === "email" ||
    type === "url" ||
    type === "password"
  ) {
    const showPattern = type === "text" || type === "email" || type === "url"

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Min Length</Label>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={validation.minLength ?? ""}
              onChange={(e) => set({ minLength: numOrUndef(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Max Length</Label>
            <Input
              type="number"
              min={0}
              placeholder="No limit"
              value={validation.maxLength ?? ""}
              onChange={(e) => set({ maxLength: numOrUndef(e.target.value) })}
            />
          </div>
        </div>

        {showPattern && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Pattern (regex)</Label>
            <Input
              type="text"
              placeholder="e.g. ^[A-Z].+"
              value={validation.pattern ?? ""}
              onChange={(e) =>
                set({ pattern: e.target.value || undefined })
              }
            />
          </div>
        )}
      </div>
    )
  }

  // ── Numeric types ────────────────────────────────────────────────
  if (type === "number" || type === "integer" || type === "float") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Min</Label>
          <Input
            type="number"
            placeholder="No min"
            value={validation.min ?? ""}
            onChange={(e) => set({ min: numOrUndef(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Max</Label>
          <Input
            type="number"
            placeholder="No max"
            value={validation.max ?? ""}
            onChange={(e) => set({ max: numOrUndef(e.target.value) })}
          />
        </div>
      </div>
    )
  }

  // ── Date types ───────────────────────────────────────────────────
  if (type === "date" || type === "datetime") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Min Date</Label>
          <Input
            type="date"
            value={validation.minDate ?? ""}
            onChange={(e) =>
              set({ minDate: e.target.value || undefined })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Max Date</Label>
          <Input
            type="date"
            value={validation.maxDate ?? ""}
            onChange={(e) =>
              set({ maxDate: e.target.value || undefined })
            }
          />
        </div>
      </div>
    )
  }

  // ── Repeater ─────────────────────────────────────────────────────
  if (type === "repeater") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Min Items</Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={validation.minItems ?? ""}
            onChange={(e) => set({ minItems: numOrUndef(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Max Items</Label>
          <Input
            type="number"
            min={0}
            placeholder="No limit"
            value={validation.maxItems ?? ""}
            onChange={(e) => set({ maxItems: numOrUndef(e.target.value) })}
          />
        </div>
      </div>
    )
  }

  // ── Types with no validation options ─────────────────────────────
  return (
    <p className="text-xs text-muted-foreground">
      No validation options for this type.
    </p>
  )
}

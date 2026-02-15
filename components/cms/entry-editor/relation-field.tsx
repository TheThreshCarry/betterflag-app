"use client"

import { useState } from "react"
import { Plus, X, GitBranch } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelationFieldProps {
  value: unknown
  onChange: (value: unknown) => void
  config?: {
    relationTo?: string
    multiple?: boolean
  }
  label: string
  description?: string
  required?: boolean
  error?: string
  showValidation?: boolean
  requirements?: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeToArray(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string")
  if (typeof value === "string") return [value]
  return []
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RelationField({
  value,
  onChange,
  config,
  label,
  description,
  required,
  error,
  showValidation,
  requirements = [],
}: RelationFieldProps) {
  const [inputValue, setInputValue] = useState("")
  const hasError = showValidation && error

  const multiple = config?.multiple ?? false
  const items = normalizeToArray(value)

  // ------- actions -------

  function addEntry(id: string) {
    const trimmed = id.trim()
    if (!trimmed) return
    if (items.includes(trimmed)) return // avoid duplicates

    if (multiple) {
      onChange([...items, trimmed])
    } else {
      onChange(trimmed)
    }
    setInputValue("")
  }

  function removeEntry(id: string) {
    if (!multiple) {
      onChange(undefined)
      return
    }
    const next = items.filter((v) => v !== id)
    onChange(next.length === 0 ? undefined : next)
  }

  // ------- render -------

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

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

      {config?.relationTo && (
        <p className="text-xs text-muted-foreground">
          Select entries from <strong>{config.relationTo}</strong>
        </p>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search entries..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addEntry(inputValue)
            }
          }}
        />
        {multiple && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!inputValue.trim()}
            onClick={() => addEntry(inputValue)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        )}
      </div>

      {/* Selected entries */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              {id}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                onClick={() => removeEntry(id)}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove {id}</span>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

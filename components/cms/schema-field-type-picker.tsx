"use client"

import type { FieldType, FieldTypeMeta } from "@/lib/cms/types"
import { FIELD_TYPE_META } from "@/lib/cms/types"
import { Card } from "@/components/ui/card"
import { FieldTypeIcon } from "./field-type-icon"
import { cn } from "@/lib/utils"

interface SchemaFieldTypePickerProps {
  onSelect: (type: FieldType) => void
  onCancel: () => void
}

const CATEGORIES = [
  { key: "basic", label: "Basic" },
  { key: "advanced", label: "Advanced" },
  { key: "relational", label: "Relational" },
] as const

function getFieldsByCategory(
  category: FieldTypeMeta["category"]
): FieldTypeMeta[] {
  return Object.values(FIELD_TYPE_META).filter(
    (meta) => meta.category === category
  )
}

export function SchemaFieldTypePicker({
  onSelect,
  onCancel,
}: SchemaFieldTypePickerProps) {
  return (
    <div className="space-y-6">

      {CATEGORIES.map(({ key, label }) => {
        const fields = getFieldsByCategory(key)
        if (fields.length === 0) return null

        return (
          <section key={key} className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {label}
            </h3>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fields.map((meta) => (
                <Card
                  key={meta.type}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(meta.type)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(meta.type)
                    }
                  }}
                  className={cn(
                    "cursor-pointer gap-2 px-3 py-3 transition-colors",
                    "hover:border-primary/50 hover:bg-accent",
                    "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2"
                  )}
                >
                  <FieldTypeIcon
                    type={meta.type}
                    className="text-muted-foreground h-5 w-5"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-none">
                      {meta.label}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {meta.description}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

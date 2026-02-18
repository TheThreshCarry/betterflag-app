"use client"

import { useState, useCallback } from "react"
import { Plus, Loader2 } from "lucide-react"
import type { SchemaField, FieldType } from "@/lib/cms/types"
import {
  addField,
  removeField,
  updateField,
  moveFieldUp,
  moveFieldDown,
  createFieldTemplate,
} from "@/lib/cms/schema-utils"
import { SchemaFieldCard } from "./schema-field-card"
import { SchemaFieldTypePicker } from "./schema-field-type-picker"
import { SchemaFieldEditor } from "./schema-field-editor"
import { SchemaLegacyBanner } from "./schema-legacy-banner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SchemaBuilderProps {
  initialFields: SchemaField[]
  onSave: (fields: SchemaField[]) => Promise<void> | void
  onCancel?: () => void
  saving?: boolean
  /** If provided, show legacy schema banner */
  isLegacy?: boolean
  onUpgradeLegacy?: () => void
  /** Other content types for relation field picker */
  otherContentTypes?: Array<{ id: string; name: string; slug: string }>
}

export function SchemaBuilder({
  initialFields,
  onSave,
  onCancel,
  saving = false,
  isLegacy = false,
  onUpgradeLegacy,
  otherContentTypes,
}: SchemaBuilderProps) {
  const [fields, setFields] = useState<SchemaField[]>(initialFields)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [editingField, setEditingField] = useState<SchemaField | null>(null)
  const [isNewField, setIsNewField] = useState(false)

  // ── Type picker flow ──────────────────────────────────────────────

  const handleAddFieldClick = useCallback(() => {
    setShowTypePicker(true)
  }, [])

  const handleTypeSelect = useCallback((type: FieldType) => {
    const template = createFieldTemplate(type)
    setEditingField(template)
    setIsNewField(true)
    setShowTypePicker(false)
  }, [])

  const handleTypePickerCancel = useCallback(() => {
    setShowTypePicker(false)
  }, [])

  // ── Field editor flow ─────────────────────────────────────────────

  const handleEditorSave = useCallback(
    (field: SchemaField) => {
      if (isNewField) {
        setFields((prev) => addField(prev, field))
      } else {
        setFields((prev) => updateField(prev, field.uid, field))
      }
      setEditingField(null)
      setIsNewField(false)
    },
    [isNewField]
  )

  const handleEditorCancel = useCallback(() => {
    setEditingField(null)
    setIsNewField(false)
  }, [])

  // ── Field card callbacks ──────────────────────────────────────────

  const handleEdit = useCallback((field: SchemaField) => {
    setEditingField(field)
    setIsNewField(false)
  }, [])

  const handleRemove = useCallback((uid: string) => {
    setFields((prev) => removeField(prev, uid))
  }, [])

  const handleMoveUp = useCallback((uid: string) => {
    setFields((prev) => moveFieldUp(prev, uid))
  }, [])

  const handleMoveDown = useCallback((uid: string) => {
    setFields((prev) => moveFieldDown(prev, uid))
  }, [])

  // ── Save / cancel ─────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    onSave(fields)
  }, [onSave, fields])

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Legacy banner */}
      {isLegacy && onUpgradeLegacy && (
        <SchemaLegacyBanner onUpgrade={onUpgradeLegacy} />
      )}

      {/* Field card list */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <SchemaFieldCard
            key={field.uid}
            field={field}
            index={index}
            total={fields.length}
            onEdit={() => handleEdit(field)}
            onRemove={() => handleRemove(field.uid)}
            onMoveUp={() => handleMoveUp(field.uid)}
            onMoveDown={() => handleMoveDown(field.uid)}
          />
        ))}
      </div>

      {/* Add field button */}
      <button
        type="button"
        onClick={handleAddFieldClick}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Add Field
      </button>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 border-t bg-background px-1 py-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save Schema"}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>

      {/* Dialog: Type picker */}
      <Dialog open={showTypePicker} onOpenChange={setShowTypePicker}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Select Field Type</DialogTitle>
          </DialogHeader>
          <SchemaFieldTypePicker
            onSelect={handleTypeSelect}
            onCancel={handleTypePickerCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Field editor */}
      <Dialog
        open={editingField !== null}
        onOpenChange={(open) => {
          if (!open) handleEditorCancel()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isNewField ? "Add Field" : "Edit Field"}
            </DialogTitle>
          </DialogHeader>
          {editingField && (
            <SchemaFieldEditor
              field={editingField}
              existingFields={fields}
              contentTypes={otherContentTypes}
              isNew={isNewField}
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

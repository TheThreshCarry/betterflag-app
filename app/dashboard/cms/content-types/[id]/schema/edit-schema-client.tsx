"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import type { ContentType } from "@/lib/db/schema"
import type { SchemaField, SchemaChange } from "@/lib/cms/types"
import {
  parseSchemaFields,
  isLegacySchema as checkLegacy,
} from "@/lib/cms/schema-utils"
import { SchemaBuilder } from "@/components/cms/schema-builder"
import { SchemaMigrationDialog } from "@/components/cms/schema-migration-dialog"
import {
  updateContentTypeSchema,
  upgradeLegacySchema,
} from "@/lib/actions/content-types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface EditSchemaClientProps {
  contentType: ContentType
  otherContentTypes: Array<{ id: string; name: string; slug: string }>
}

export function EditSchemaClient({
  contentType,
  otherContentTypes,
}: EditSchemaClientProps) {
  const router = useRouter()

  const initialFields = parseSchemaFields(contentType.schema)
  const isLegacy = checkLegacy(contentType.schema)

  const [saving, setSaving] = useState(false)
  const [migrationChanges, setMigrationChanges] = useState<
    SchemaChange[] | null
  >(null)
  const [pendingFields, setPendingFields] = useState<SchemaField[] | null>(null)
  const [confirming, setConfirming] = useState(false)

  const schemaVersion =
    typeof contentType.schema === "object" &&
    contentType.schema !== null &&
    "version" in (contentType.schema as Record<string, unknown>)
      ? ((contentType.schema as Record<string, unknown>).version as number)
      : 1

  const handleSave = useCallback(
    async (fields: SchemaField[]) => {
      setSaving(true)
      try {
        const result = await updateContentTypeSchema(contentType.id, fields)

        if (result.requiresConfirmation) {
          setMigrationChanges(result.changes ?? [])
          setPendingFields(fields)
          return
        }

        if (result.success) {
          toast.success("Schema updated successfully")
          router.refresh()
        } else if (!result.requiresConfirmation) {
          toast.error("Failed to update schema")
        }
      } catch (error) {
        toast.error("An unexpected error occurred")
        console.error("Schema save error:", error)
      } finally {
        setSaving(false)
      }
    },
    [contentType.id, router]
  )

  const handleConfirmMigration = useCallback(async () => {
    if (!pendingFields) return

    setConfirming(true)
    try {
      const result = await updateContentTypeSchema(
        contentType.id,
        pendingFields,
        { force: true }
      )

      if (result.success) {
        toast.success("Schema updated with migration applied")
        setMigrationChanges(null)
        setPendingFields(null)
        router.refresh()
      } else {
        toast.error("Failed to apply migration")
      }
    } catch (error) {
      toast.error("An unexpected error occurred during migration")
      console.error("Migration error:", error)
    } finally {
      setConfirming(false)
    }
  }, [contentType.id, pendingFields, router])

  const handleCancelMigration = useCallback(() => {
    setMigrationChanges(null)
    setPendingFields(null)
  }, [])

  const handleUpgradeLegacy = useCallback(async () => {
    setSaving(true)
    try {
      const result = await upgradeLegacySchema(contentType.id)

      if (result.success) {
        toast.success("Schema upgraded to latest format")
        router.refresh()
      } else {
        toast.error("Failed to upgrade schema")
      }
    } catch (error) {
      toast.error("An unexpected error occurred during upgrade")
      console.error("Legacy upgrade error:", error)
    } finally {
      setSaving(false)
    }
  }, [contentType.id, router])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(`/dashboard/cms/content-types/${contentType.id}`)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {contentType.name}
          </Button>

          <h1 className="text-2xl font-bold">Edit Schema</h1>

          <Badge variant="outline">v{schemaVersion}</Badge>

          {isLegacy ? (
            <Badge variant="destructive">Legacy</Badge>
          ) : (
            <Badge variant="secondary">Current</Badge>
          )}
        </div>

        {isLegacy && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpgradeLegacy}
            disabled={saving}
          >
            Upgrade Schema
          </Button>
        )}
      </div>

      {/* Schema Builder */}
      <SchemaBuilder
        initialFields={initialFields}
        otherContentTypes={otherContentTypes}
        onSave={handleSave}
        saving={saving}
        isLegacy={isLegacy}
      />

      {/* Migration Confirmation Dialog */}
      {migrationChanges !== null && (
        <SchemaMigrationDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) handleCancelMigration()
          }}
          changes={migrationChanges}
          onConfirm={handleConfirmMigration}
          confirming={confirming}
        />
      )}
    </div>
  )
}

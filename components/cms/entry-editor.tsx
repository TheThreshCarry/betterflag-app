"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PanelRight, X } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { MediaField } from "./entry-editor/media-field";
import { RelationField } from "./entry-editor/relation-field";
import { RepeaterField } from "./entry-editor/repeater-field";
import { CmsRichTextEditor } from "./entry-editor/cms-rich-text-editor";

import { parseSchemaFields, getFieldLabel } from "@/lib/cms/schema-utils";
import {
  validateEntryData,
  coerceFieldValues,
  getFieldRequirements,
} from "@/lib/cms/schema-validation";
import { deriveEntryDisplayTitle } from "@/lib/cms/entry-label";
import type { SchemaField as SchemaFieldType } from "@/lib/cms/types";

import type { ContentType, Entry } from "@/lib/db/schema";
import { createEntry, updateEntry, publishEntry } from "@/lib/actions/entries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntryEditorProps {
  contentType: ContentType;
  entry?: Entry;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function getInitialFieldValues(
  fields: SchemaFieldType[],
  existingData: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const key = field.name;
    if (existingData && key in existingData) {
      values[key] = existingData[key];
    } else if (field.default !== undefined) {
      values[key] = field.default;
    } else {
      switch (field.type) {
        case "boolean":
          values[key] = false;
          break;
        case "number":
        case "integer":
        case "float":
          values[key] = "";
          break;
        case "json":
          values[key] = "";
          break;
        case "richtext":
          values[key] = {
            type: "doc",
            content: [{ type: "paragraph", content: [] }],
          };
          break;
        case "media":
        case "relation":
        case "repeater":
          values[key] = field.config?.multiple ? [] : null;
          break;
        default:
          values[key] = "";
      }
    }
  }
  return values;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntryEditor({ contentType, entry }: EntryEditorProps) {
  const router = useRouter();
  const isEditing = !!entry;

  const schemaFields = parseSchemaFields(contentType.schema);
  const hasSchemaFields = schemaFields.length > 0;

  const entryData = (entry?.data ?? {}) as Record<string, unknown>;

  const [slug, setSlug] = useState<string>(entry?.slug || "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(() =>
    getInitialFieldValues(schemaFields, entryData)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const coercedValues = useMemo(() => {
    if (!hasSchemaFields) return {};
    return coerceFieldValues(schemaFields, fieldValues);
  }, [hasSchemaFields, schemaFields, fieldValues]);

  const fieldValidationResult = useMemo(() => {
    if (!hasSchemaFields) return { success: true as const, errors: {} };
    return validateEntryData(schemaFields, coercedValues);
  }, [hasSchemaFields, schemaFields, coercedValues]);

  const fieldErrors = showValidation ? fieldValidationResult.errors : {};

  const derivedLabel = useMemo(
    () => deriveEntryDisplayTitle(coercedValues as Record<string, unknown>),
    [coercedValues]
  );

  useEffect(() => {
    if (!slugManuallyEdited && derivedLabel && derivedLabel !== "Untitled") {
      setSlug(slugify(derivedLabel));
    }
  }, [derivedLabel, slugManuallyEdited]);

  const handleSlugChange = useCallback((value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
  }, []);

  const setFieldValue = useCallback((key: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  function buildDataPayload(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    if (!hasSchemaFields) return data;

      for (const field of schemaFields) {
        const key = field.name;
        let val = fieldValues[key];

        if (
          (field.type === "number" ||
            field.type === "integer" ||
            field.type === "float") &&
          val !== "" &&
          val !== undefined
        ) {
          val = Number(val);
        }

        if (field.type === "json" && typeof val === "string" && val.trim()) {
          try {
            val = JSON.parse(val);
        } catch {
          /* keep string */
        }
        }

        if (field.type === "boolean") {
          val = !!val;
        }

        data[key] = val;
      }
    return data;
  }

  const canSaveDraft = hasSchemaFields;
  const canPublish =
    hasSchemaFields &&
    slug.trim().length > 0 &&
    fieldValidationResult.success;

  function validateForDraft(): boolean {
    if (!hasSchemaFields) {
      toast.error("Add at least one field to the content type schema first.");
      return false;
    }
    return true;
  }

  function validateForPublish(): boolean {
    setShowValidation(true);
    if (!hasSchemaFields) {
      toast.error("Add fields to the content type schema before publishing.");
      return false;
    }
    const slugValid = slug.trim().length > 0;
    const fieldsValid = fieldValidationResult.success;
    if (!slugValid || !fieldsValid) {
      toast.error("Please fix all validation errors before publishing");
      return false;
    }
    return true;
  }

  const handleIgnoreChanges = () => {
    router.push(`/dashboard/cms/content-types/${contentType.id}/entries`);
  };

  const handleSave = async () => {
    if (!validateForDraft()) return;
    setIsSaving(true);
    try {
      const data = buildDataPayload();
      const entryTitle = deriveEntryDisplayTitle(data);
      if (isEditing) {
        await updateEntry(entry.id, { slug, data, title: entryTitle });
        toast.success("Entry saved");
      } else {
        const created = await createEntry({
          contentTypeId: contentType.id,
          slug,
          data,
          status: "draft",
          title: entryTitle,
        });
        toast.success("Entry created");
        router.push(
          `/dashboard/cms/content-types/${contentType.id}/entries/${created.id}/edit`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForPublish()) return;
    setIsPublishing(true);
    try {
      const data = buildDataPayload();
      const entryTitle = deriveEntryDisplayTitle(data);
      if (isEditing) {
        await updateEntry(entry.id, { slug, data, title: entryTitle });
        await publishEntry(entry.id);
        toast.success("Entry published!");
        router.push(`/dashboard/cms/content-types/${contentType.id}/entries`);
      } else {
        const created = await createEntry({
          contentTypeId: contentType.id,
          slug,
          data,
          status: "draft",
          title: entryTitle,
        });
        await publishEntry(created.id);
        toast.success("Entry published!");
        router.push(`/dashboard/cms/content-types/${contentType.id}/entries`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to publish entry"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const isBusy = isSaving || isPublishing;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-2 border-b border-border/60 bg-background py-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-sm font-medium"
            onClick={handleIgnoreChanges}
            disabled={isBusy}
          >
            Ignore Changes
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-8 px-4 text-sm font-medium"
            onClick={handleSave}
            disabled={isBusy || !canSaveDraft}
          >
            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-8 px-4 text-sm font-medium"
            onClick={handlePublish}
            disabled={isBusy || !canPublish}
          >
            {isPublishing && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Publish
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-8 w-8"
            onClick={() => setSidebarOpen((p) => !p)}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto">
          {hasSchemaFields ? (
            <div className="w-full max-w-none px-1 py-8 sm:px-2 space-y-8">
              {schemaFields.map((field) => (
                  <CompactFieldInput
                    key={field.uid}
                    field={field}
                    value={fieldValues[field.name]}
                    onChange={(val) => setFieldValue(field.name, val)}
                    error={fieldErrors[field.name]}
                    showValidation={showValidation}
                  />
                ))}
            </div>
          ) : (
            <div className="w-full max-w-none px-2 py-16 text-center text-muted-foreground text-sm">
              <p className="font-medium text-foreground mb-2">No fields defined</p>
              <p>
                Add fields to this content type&apos;s schema to edit entries. Open
                the content type and use the schema editor.
              </p>
            </div>
          )}
        </div>

        <div
          className={`border-l border-border/60 bg-background transition-all duration-200 ease-in-out overflow-y-auto ${
            sidebarOpen ? "w-72 min-w-[18rem]" : "w-0 min-w-0 border-l-0"
          }`}
        >
          {sidebarOpen && (
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Details</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {isEditing && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge
                    variant={entry.status === "published" ? "default" : "outline"}
                  >
                    {entry.status}
                  </Badge>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="sidebar-slug" className="text-xs text-muted-foreground">
                  Slug
                </Label>
                <Input
                  id="sidebar-slug"
                  placeholder="url-segment"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={`h-8 text-xs ${
                    showValidation && !slug.trim() ? "border-destructive" : ""
                  }`}
                />
                {showValidation && !slug.trim() && (
                  <p className="text-xs text-destructive">Slug is required</p>
                )}
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Auto-filled from the entry label until you edit it.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_RICHTEXT_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [] }],
};

function normalizeRichtextValue(value: unknown): JSONContent {
  if (value && typeof value === "object" && "type" in value) {
    return value as JSONContent;
  }
  return EMPTY_RICHTEXT_DOC;
}

// ---------------------------------------------------------------------------
// Compact field renderer (one control per schema field)
// ---------------------------------------------------------------------------

function CompactFieldInput({
  field,
  value,
  onChange,
  error,
  showValidation,
}: {
  field: SchemaFieldType;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
  showValidation?: boolean;
}) {
  const label = getFieldLabel(field);
  const id = `field-${field.uid}`;
  const hasError = showValidation && error;
  const requirements = getFieldRequirements(field);

  const renderHelper = () => {
    if (hasError) {
      return <p className="text-xs text-destructive">{error}</p>;
    }
    if (field.description) {
      return <p className="text-xs text-muted-foreground">{field.description}</p>;
    }
    return null;
  };

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </Label>
          <Input
            id={id}
            placeholder={field.placeholder || ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "richtext":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </Label>
          <div
            className={`rounded-lg border border-border/80 bg-background min-w-0 ${hasError ? "ring-1 ring-destructive" : ""}`}
          >
            <CmsRichTextEditor
              value={normalizeRichtextValue(value)}
              onChange={(doc) => onChange(doc)}
              placeholder={field.placeholder || "…"}
            />
          </div>
          {renderHelper()}
        </div>
      );

    case "number":
    case "integer":
    case "float":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Input
            id={id}
            type="number"
            step={field.type === "integer" ? "1" : "any"}
            placeholder={field.placeholder || ""}
            value={(value as string | number) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "boolean":
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Switch
              id={id}
              checked={!!value}
              onCheckedChange={(checked) => onChange(checked)}
            />
            <Label htmlFor={id} className="text-xs cursor-pointer">
              {label}
            </Label>
          </div>
          {renderHelper()}
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Input
            id={id}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "datetime":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Input
            id={id}
            type="datetime-local"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "enum":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Select
            value={(value as string) ?? undefined}
            onValueChange={(val) => onChange(val)}
          >
            <SelectTrigger id={id} className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}>
              <SelectValue placeholder={field.placeholder || `Select ${label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {(field.config?.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {renderHelper()}
        </div>
      );

    case "email":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Input
            id={id}
            type="email"
            placeholder={field.placeholder || "user@example.com"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "url":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Input
            id={id}
            type="url"
            placeholder={field.placeholder || "https://example.com"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "password":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Input
            id={id}
            type="password"
            placeholder={field.placeholder || ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "json":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Textarea
            id={id}
            placeholder={field.placeholder || '{ "key": "value" }'}
            value={
              typeof value === "string"
                ? value
                : value !== undefined && value !== null
                  ? JSON.stringify(value, null, 2)
                  : ""
            }
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={`min-h-[80px] resize-y font-mono text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );

    case "media":
      return (
        <div className="space-y-1.5">
          <MediaField
            label={label}
            value={value}
            onChange={onChange}
            config={field.config}
            description={field.description}
            required={field.required}
            error={error}
            showValidation={showValidation}
            requirements={requirements}
          />
        </div>
      );

    case "relation":
      return (
        <div className="space-y-1.5">
          <RelationField
            label={label}
            value={value}
            onChange={onChange}
            config={field.config}
            description={field.description}
            required={field.required}
            error={error}
            showValidation={showValidation}
            requirements={requirements}
          />
        </div>
      );

    case "repeater":
      return (
        <div className="space-y-1.5">
          <RepeaterField
            label={label}
            value={value}
            onChange={onChange}
            componentFields={field.config?.componentFields ?? []}
            description={field.description}
            validation={field.validation}
            error={error}
            showValidation={showValidation}
            requirements={requirements}
          />
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Input
            id={id}
            placeholder={field.placeholder || ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 text-xs ${hasError ? "border-destructive" : ""}`}
          />
          {renderHelper()}
        </div>
      );
  }
}

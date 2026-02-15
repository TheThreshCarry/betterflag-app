"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { parseSchemaFields, getFieldLabel } from "@/lib/cms/schema-utils";
import {
  validateEntryData,
  coerceFieldValues,
  getFieldRequirements,
} from "@/lib/cms/schema-validation";
import type { SchemaField as SchemaFieldType } from "@/lib/cms/types";

import type { ContentType, Entry } from "@/lib/db/schema";
import {
  createEntry,
  updateEntry,
  publishEntry,
  unpublishEntry,
} from "@/lib/actions/entries";

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

  const [title, setTitle] = useState<string>((entryData.title as string) || "");
  const [slug, setSlug] = useState<string>(entry?.slug || "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(() =>
    getInitialFieldValues(schemaFields, entryData)
  );
  // Fallback "content" field when schema has no fields
  const [fallbackContent, setFallbackContent] = useState<string>(
    (entryData.content as string) || ""
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const coercedValues = useMemo(() => {
    if (!hasSchemaFields) return {};
    return coerceFieldValues(schemaFields, fieldValues);
  }, [hasSchemaFields, schemaFields, fieldValues]);

  const fieldValidationResult = useMemo(() => {
    if (!hasSchemaFields) return { success: true as const, errors: {} };
    return validateEntryData(schemaFields, coercedValues);
  }, [hasSchemaFields, schemaFields, coercedValues]);

  const titleError =
    showValidation && !title.trim() ? "Title is required" : null;
  const slugError = showValidation && !slug.trim() ? "Slug is required" : null;
  const fieldErrors = showValidation ? fieldValidationResult.errors : {};

  // Draft: only title required. Publish: full validation required.
  const canSaveDraft = title.trim().length > 0;
  const canPublish =
    title.trim().length > 0 &&
    slug.trim().length > 0 &&
    fieldValidationResult.success;

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManuallyEdited]);

  const handleSlugChange = useCallback((value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
  }, []);

  const setFieldValue = useCallback((key: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Build the data payload that goes into entry.data
  function buildDataPayload(): Record<string, unknown> {
    const data: Record<string, unknown> = { title };

    if (hasSchemaFields) {
      for (const field of schemaFields) {
        const key = field.name;
        let val = fieldValues[key];

        // Coerce types
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
            // keep as string — the user may still be editing
          }
        }

        // Boolean: ensure it stays a boolean
        if (field.type === "boolean") {
          val = !!val;
        }

        // Media, relation, repeater: store as-is (managed by sub-components)
        // No coercion needed

        data[key] = val;
      }
    } else {
      data.content = fallbackContent;
    }

    return data;
  }

  function validateForDraft(): boolean {
    const titleValid = title.trim().length > 0;
    if (!titleValid) {
      setShowValidation(true);
      toast.error("Title is required");
      return false;
    }
    return true;
  }

  function validateForPublish(): boolean {
    setShowValidation(true);

    const titleValid = title.trim().length > 0;
    const slugValid = slug.trim().length > 0;

    let fieldsValid = true;
    if (hasSchemaFields) {
      const coerced = coerceFieldValues(schemaFields, fieldValues);
      const result = validateEntryData(schemaFields, coerced);
      fieldsValid = result.success;
    }

    if (!titleValid || !slugValid || !fieldsValid) {
      toast.error("Please fix all validation errors before publishing");
      return false;
    }

    return true;
  }

  const handleSave = async () => {
    if (!validateForDraft()) return;

    setIsSaving(true);
    try {
      const data = buildDataPayload();

      if (isEditing) {
        await updateEntry(entry.id, {
          slug,
          data,
          title,
        });
        toast.success("Entry saved");
      } else {
        const created = await createEntry({
          contentTypeId: contentType.id,
          slug,
          data,
          status: "draft",
          title,
        });
        toast.success("Entry created");
        router.push(
          `/dashboard/cms/content-types/${contentType.id}/entries/${created.id}/edit`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save entry";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForPublish()) return;

    setIsPublishing(true);
    try {
      const data = buildDataPayload();

      if (isEditing) {
        await updateEntry(entry.id, {
          slug,
          data,
          title,
        });
        await publishEntry(entry.id);
        toast.success("Entry published!");
        router.push(`/dashboard/cms/content-types/${contentType.id}`);
      } else {
        const created = await createEntry({
          contentTypeId: contentType.id,
          slug,
          data,
          status: "draft",
          title,
        });
        await publishEntry(created.id);
        toast.success("Entry published!");
        router.push(`/dashboard/cms/content-types/${contentType.id}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to publish entry";
      toast.error(message);
    } finally {
      setIsPublishing(false);
    }
  };

  const isBusy = isSaving || isPublishing;

  return (
    <div className="space-y-6">
      {/* ---- Top bar ---- */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() =>
            router.push(
              `/dashboard/cms/content-types/${contentType.id}/entries`
            )
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {contentType.name}
        </Button>
        <div className="flex items-center gap-2">
          {isEditing && (
            <Badge
              variant={entry.status === "published" ? "default" : "outline"}
            >
              {entry.status}
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isBusy || !canSaveDraft}
            title={!canSaveDraft ? "Title is required" : ""}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isBusy || !canPublish}
            title={
              !canPublish
                ? "Please fill in all required fields before publishing"
                : ""
            }
          >
            {isPublishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {/* ---- Title ---- */}
      <div>
        <Input
          placeholder="Entry title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`text-2xl font-bold h-14 border-none shadow-none focus-visible:ring-0 px-0 text-foreground placeholder:text-muted-foreground/50 pl-4 ${
            showValidation && titleError
              ? "border-b-2 border-destructive rounded-none"
              : ""
          }`}
        />
        {showValidation && titleError && (
          <p className="text-sm text-destructive pl-4 mt-1">{titleError}</p>
        )}
      </div>

      {/* ---- Slug ---- */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="entry-slug">Slug</Label>
            <Input
              id="entry-slug"
              placeholder="auto-generated-from-title"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className={
                showValidation && slugError ? "border-destructive" : ""
              }
            />
            {showValidation && slugError ? (
              <p className="text-xs text-destructive">{slugError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Auto-generated from title unless
                manually edited.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ---- Dynamic fields or fallback ---- */}
      {hasSchemaFields ? (
        <div className="space-y-6">
          {schemaFields.map((field) => (
            <SchemaFieldInput
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Content</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Write your content here..."
              value={fallbackContent}
              onChange={(e) => setFallbackContent(e.target.value)}
              rows={16}
              className="min-h-[320px] resize-y"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema-driven field renderer (all 14 types + fallback)
// ---------------------------------------------------------------------------

function SchemaFieldInput({
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
    const parts: React.ReactNode[] = [];
    if (field.description) {
      parts.push(<span key="desc">{field.description}</span>);
    }
    if (requirements.length > 0) {
      parts.push(
        <span key="reqs" className="text-muted-foreground/70">
          [{requirements.join(" • ")}]
        </span>
      );
    }
    if (parts.length > 0) {
      return <p className="text-xs text-muted-foreground">{parts}</p>;
    }
    return null;
  };

  switch (field.type) {
    case "text":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              placeholder={field.placeholder || ""}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "richtext":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Textarea
              id={id}
              placeholder={field.placeholder || ""}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              rows={12}
              className={`min-h-[240px] resize-y ${hasError ? "border-destructive" : ""}`}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "number":
    case "integer":
    case "float":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="number"
              step={field.type === "integer" ? "1" : "any"}
              placeholder={field.placeholder || ""}
              value={(value as string | number) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "boolean":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                id={id}
                checked={!!value}
                onCheckedChange={(checked) => onChange(checked)}
              />
              <Label htmlFor={id} className="cursor-pointer">
                {label}
              </Label>
            </div>
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "date":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="date"
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "datetime":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="datetime-local"
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "enum":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Select
              value={(value as string) ?? undefined}
              onValueChange={(val) => onChange(val)}
            >
              <SelectTrigger
                id={id}
                className={hasError ? "border-destructive" : ""}
              >
                <SelectValue
                  placeholder={
                    field.placeholder || `Select ${label.toLowerCase()}...`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(field.config?.options ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "email":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="email"
              placeholder={field.placeholder || "user@example.com"}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "url":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="url"
              placeholder={field.placeholder || "https://example.com"}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "password":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="password"
              placeholder={field.placeholder || ""}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "json":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
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
              rows={8}
              className={`min-h-[160px] resize-y font-mono text-sm ${hasError ? "border-destructive" : ""}`}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );

    case "media":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
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
          </CardContent>
        </Card>
      );

    case "relation":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
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
          </CardContent>
        </Card>
      );

    case "repeater":
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
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
          </CardContent>
        </Card>
      );

    default:
      return (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              placeholder={field.placeholder || ""}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={hasError ? "border-destructive" : ""}
            />
            {renderHelper()}
          </CardContent>
        </Card>
      );
  }
}

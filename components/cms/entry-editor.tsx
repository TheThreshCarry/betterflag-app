"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  PanelRight,
  X,
  Plus,
  ImageIcon,
  Upload,
  Trash2,
  Maximize,
  Minimize,
  Square,
  RectangleHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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

const PROMOTED_FIELD_NAMES = new Set([
  "title",
  "subtitle",
  "excerpt",
  "description",
  "author",
  "authors",
  "content",
  "body",
  "cover_image",
  "coverImage",
  "cover",
  "featured_image",
  "featuredImage",
  "thumbnail",
]);

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
  const [fallbackContent, setFallbackContent] = useState<string>(
    (entryData.content as string) || ""
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

  const canSaveDraft = title.trim().length > 0;
  const canPublish =
    title.trim().length > 0 &&
    slug.trim().length > 0 &&
    fieldValidationResult.success;

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

  // Separate promoted fields (shown inline in doc body) from sidebar fields
  const coverImageField = schemaFields.find(
    (f) =>
      (f.name === "cover_image" ||
        f.name === "coverImage" ||
        f.name === "cover" ||
        f.name === "featured_image" ||
        f.name === "featuredImage" ||
        f.name === "thumbnail") &&
      f.type === "media"
  );
  const subtitleField = schemaFields.find(
    (f) => (f.name === "subtitle" || f.name === "excerpt" || f.name === "description") && f.type === "text"
  );
  const authorField = schemaFields.find(
    (f) => (f.name === "author" || f.name === "authors") && f.type === "relation"
  );
  const contentField = schemaFields.find(
    (f) => (f.name === "content" || f.name === "body") && f.type === "richtext"
  );

  const sidebarFields = schemaFields.filter((f) => {
    if (f.name === "title") return false;
    if (coverImageField && f.uid === coverImageField.uid) return false;
    if (subtitleField && f.uid === subtitleField.uid) return false;
    if (authorField && f.uid === authorField.uid) return false;
    if (contentField && f.uid === contentField.uid) return false;
    return true;
  });

  // Build the data payload
  function buildDataPayload(): Record<string, unknown> {
    const data: Record<string, unknown> = { title };

    if (hasSchemaFields) {
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
          } catch {}
        }

        if (field.type === "boolean") {
          val = !!val;
        }

        data[key] = val;
      }
    } else {
      data.content = fallbackContent;
    }

    return data;
  }

  function validateForDraft(): boolean {
    if (!title.trim()) {
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

  const handleIgnoreChanges = () => {
    router.push(`/dashboard/cms/content-types/${contentType.id}/entries`);
  };

  const handleSave = async () => {
    if (!validateForDraft()) return;
    setIsSaving(true);
    try {
      const data = buildDataPayload();
      if (isEditing) {
        await updateEntry(entry.id, { slug, data, title });
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
      if (isEditing) {
        await updateEntry(entry.id, { slug, data, title });
        await publishEntry(entry.id);
        toast.success("Entry published!");
        router.push(`/dashboard/cms/content-types/${contentType.id}/entries`);
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

  const displayTitle = title.trim() || (isEditing ? "Untitled" : "New Entry");

  const coverImageValue = coverImageField
    ? (fieldValues[coverImageField.name] as string | null)
    : null;

  const [coverFit, setCoverFit] = useState<"cover" | "contain" | "fill">("cover");

  const documentHeader = (
    <>
      {coverImageField && (
        <CoverImage
          value={coverImageValue}
          onChange={(val) => setFieldValue(coverImageField.name, val)}
          fit={coverFit}
          onFitChange={setCoverFit}
        />
      )}
      <div className="mx-auto max-w-2xl px-8 pt-10 pb-2">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-[2rem] font-semibold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/40 outline-none"
        />
        {showValidation && !title.trim() && (
          <p className="text-sm text-destructive mt-1">Title is required</p>
        )}

        {subtitleField && (
          <input
            type="text"
            placeholder="Add a subtitle..."
            value={(fieldValues[subtitleField.name] as string) ?? ""}
            onChange={(e) => setFieldValue(subtitleField.name, e.target.value)}
            className="mt-3 w-full bg-transparent text-lg text-muted-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        )}

        {authorField && (
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <AuthorChips
              value={fieldValues[authorField.name]}
              onChange={(val) => setFieldValue(authorField.name, val)}
              config={authorField.config}
            />
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* ---- Header bar ---- */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background px-5 py-2.5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/cms">
                Blogs &amp; CMS
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                href={`/dashboard/cms/content-types/${contentType.id}/entries`}
              >
                {contentType.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-primary font-medium">
                {displayTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-2">
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
            variant="outline"
            size="sm"
            className="h-8 px-4 text-sm font-medium"
            onClick={handleSave}
            disabled={isBusy || !canSaveDraft}
          >
            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Draft
          </Button>
          <Button
            size="sm"
            className="h-8 px-4 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
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
      </div>

      {/* ---- Main content area with optional sidebar ---- */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Document body */}
        <div className="flex-1 overflow-y-auto">
          {contentField ? (
            <CmsRichTextEditor
              value={fieldValues[contentField.name] as JSONContent | undefined}
              onChange={(val) => setFieldValue(contentField.name, val)}
              placeholder="Start writing..."
              headerContent={documentHeader}
            />
          ) : hasSchemaFields ? (
            <div className="mx-auto max-w-2xl px-8 py-10 space-y-6">
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-[2rem] font-semibold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              {showValidation && !title.trim() && (
                <p className="text-sm text-destructive mt-1">Title is required</p>
              )}

              {subtitleField && (
                <input
                  type="text"
                  placeholder="Add a subtitle..."
                  value={(fieldValues[subtitleField.name] as string) ?? ""}
                  onChange={(e) =>
                    setFieldValue(subtitleField.name, e.target.value)
                  }
                  className="mt-3 w-full bg-transparent text-lg text-muted-foreground placeholder:text-muted-foreground/40 outline-none"
                />
              )}

              <Separator />

              {schemaFields
                .filter((f) => f.name !== "title" && (!subtitleField || f.uid !== subtitleField.uid))
                .map((field) => (
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
            <div className="mx-auto max-w-2xl px-8 py-10 space-y-6">
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-[2rem] font-semibold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              {showValidation && !title.trim() && (
                <p className="text-sm text-destructive mt-1">Title is required</p>
              )}
              <Separator />
              <Textarea
                placeholder="Write your content here..."
                value={fallbackContent}
                onChange={(e) => setFallbackContent(e.target.value)}
                rows={16}
                className="min-h-[320px] resize-y border-none shadow-none focus-visible:ring-0"
              />
            </div>
          )}
        </div>

        {/* ---- Collapsible metadata sidebar ---- */}
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
                  placeholder="auto-generated-from-title"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={`h-8 text-xs ${
                    showValidation && !slug.trim() ? "border-destructive" : ""
                  }`}
                />
                {showValidation && !slug.trim() && (
                  <p className="text-xs text-destructive">Slug is required</p>
                )}
              </div>

              <Separator />

              {sidebarFields.map((field) => (
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
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Author chips component
// ---------------------------------------------------------------------------

function AuthorChips({
  value,
  onChange,
  config,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  config?: SchemaFieldType["config"];
}) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const isMultiple = config?.multiple;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((item, idx) => {
        const label =
          typeof item === "object" && item !== null
            ? (item as Record<string, unknown>).title ||
              (item as Record<string, unknown>).name ||
              (item as Record<string, unknown>).id
            : String(item);
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            {String(label)}
            <button
              type="button"
              onClick={() => {
                if (isMultiple) {
                  const next = items.filter((_, i) => i !== idx);
                  onChange(next);
                } else {
                  onChange(null);
                }
              }}
              className="rounded-full p-0.5 text-emerald-600 hover:bg-emerald-200 hover:text-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-800 dark:hover:text-emerald-200 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={() => {
          toast.info("Use the sidebar to manage authors via the relation field");
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover image component
// ---------------------------------------------------------------------------

const COVER_FIT_OPTIONS = [
  { value: "cover" as const, label: "Cover (fill & crop)", icon: Maximize },
  { value: "contain" as const, label: "Contain (fit inside)", icon: Minimize },
  { value: "fill" as const, label: "Fill (stretch)", icon: RectangleHorizontal },
];

function CoverImage({
  value,
  onChange,
  fit = "cover",
  onFitChange,
}: {
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  fit?: "cover" | "contain" | "fill";
  onFitChange?: (fit: "cover" | "contain" | "fill") => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const base64 = await fileToBase64(file);
    onChange(base64);
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file) await handleFile(file);
      }}
    />
  );

  if (value) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group/cover relative w-full h-72 bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Cover"
              className={`w-full h-full object-${fit}`}
              style={fit === "contain" ? { backgroundColor: "var(--muted)" } : undefined}
            />
            <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/30 transition-colors" />
            <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs shadow-md"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs shadow-md text-destructive hover:text-destructive"
                onClick={() => onChange(null)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
            {fileInput}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Change image
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Square className="mr-2 h-4 w-4" />
              Fill type
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {COVER_FIT_OPTIONS.map(({ value: v, label, icon: Icon }) => (
                <ContextMenuItem
                  key={v}
                  onClick={() => onFitChange?.(v)}
                  className={fit === v ? "bg-accent" : ""}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onChange(null)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove cover
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <>
      {fileInput}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) await handleFile(file);
        }}
        className={`w-full h-72 flex flex-col items-center justify-center gap-2 text-sm transition-colors duration-200 ${
          isDragging
            ? "bg-primary/5 text-primary border-b border-primary/20"
            : "bg-muted/30 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 dark:bg-muted/25 dark:hover:bg-muted/50"
        }`}
      >
        <ImageIcon className="h-5 w-5" />
        Add cover image
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Compact field renderer (used in sidebar & fallback body)
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

    case "richtext":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
          <Textarea
            id={id}
            placeholder={field.placeholder || ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            className={`min-h-[120px] resize-y text-xs ${hasError ? "border-destructive" : ""}`}
          />
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

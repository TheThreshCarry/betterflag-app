"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Newspaper,
  FileText,
  Plus,
} from "lucide-react"
import { SchemaBuilder } from "@/components/cms/schema-builder"
import { FieldTypeIcon } from "@/components/cms/field-type-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper"
import type { SchemaField } from "@/lib/cms/types"
import { getFieldLabel, getFieldSummary } from "@/lib/cms/schema-utils"
import { createContentType } from "@/lib/actions/content-types"
import {
  CONTENT_TYPE_TEMPLATES,
  type ContentTypeTemplate,
} from "@/lib/cms/content-type-templates"

// ─── Helpers ───────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

const TEMPLATE_ICONS = {
  newspaper: Newspaper,
  "file-text": FileText,
  box: FileText,
} as const

const STEPS = [
  { number: 1, label: "Template" },
  { number: 2, label: "Name" },
  { number: 3, label: "Schema" },
  { number: 4, label: "Review" },
] as const

// ─── Template Card ─────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: ContentTypeTemplate
  selected: boolean
  onSelect: () => void
}) {
  const Icon = TEMPLATE_ICONS[template.icon]

  return (
    <button type="button" onClick={onSelect} className="text-left w-full">
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          selected
            ? "ring-2 ring-primary border-primary"
            : "hover:border-foreground/20"
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <CardDescription className="text-xs">
                {template.fields.length} fields pre-configured
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">
            {template.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {template.fields.slice(0, 5).map((field) => (
              <Badge key={field.uid} variant="secondary" className="text-xs">
                {field.label || field.name}
              </Badge>
            ))}
            {template.fields.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{template.fields.length - 5} more
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

// ─── Wizard ────────────────────────────────────────────────────────

export function NewContentTypeWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const stepParam = Number(searchParams.get("step")) || 1
  const step = Math.min(Math.max(stepParam, 1), 4)

  // Form state
  const [selectedTemplate, setSelectedTemplate] =
    useState<ContentTypeTemplate | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [fields, setFields] = useState<SchemaField[]>([])
  const [isCreating, setIsCreating] = useState(false)

  // ── Navigation helpers ───────────────────────────────────────────

  const goToStep = useCallback(
    (s: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("step", String(s))
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  // ── Template selection ───────────────────────────────────────────

  const handleSelectTemplate = useCallback(
    (template: ContentTypeTemplate) => {
      setSelectedTemplate(template)
      setName(template.name)
      setSlug(template.slug)
      setSlugTouched(false)
      setFields(template.fields)
    },
    []
  )

  const handleStartFromScratch = useCallback(() => {
    setSelectedTemplate(null)
    if (!name) {
      setName("")
      setSlug("")
    }
    setSlugTouched(false)
    goToStep(2)
  }, [name, goToStep])

  const handleContinueFromTemplate = useCallback(() => {
    goToStep(2)
  }, [goToStep])

  // ── Name change handler (auto-slug) ──────────────────────────────

  const handleNameChange = useCallback(
    (value: string) => {
      setName(value)
      if (!slugTouched) {
        setSlug(slugify(value))
      }
    },
    [slugTouched]
  )

  const handleSlugChange = useCallback((value: string) => {
    setSlugTouched(true)
    setSlug(slugify(value))
  }, [])

  // ── Step 2 → 3 ──────────────────────────────────────────────────

  const handleContinueToSchema = useCallback(() => {
    if (!name.trim()) {
      toast.error("Please enter a name for your content type.")
      return
    }
    goToStep(3)
  }, [name, goToStep])

  // ── Step 3: SchemaBuilder save → Step 4 ──────────────────────────

  const handleSchemaSave = useCallback(
    async (savedFields: SchemaField[]) => {
      setFields(savedFields)
      goToStep(4)
    },
    [goToStep]
  )

  const handleSchemaCancel = useCallback(() => {
    goToStep(2)
  }, [goToStep])

  // ── Step 4: Create ──────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setIsCreating(true)
    try {
      const entry = await createContentType({
        name: name.trim(),
        schema: { version: 2, fields },
      })
      toast.success("Content type created successfully.")
      router.push(`/dashboard/cms/content-types/${entry.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create content type."
      )
      setIsCreating(false)
    }
  }, [name, fields, router])

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Stepper
        value={step}
        onValueChange={goToStep}
        indicators={{ completed: <Check className="size-3.5" /> }}
        className="mb-8"
      >
        <StepperNav className="justify-center gap-2">
          {STEPS.map(({ number, label }) => (
            <StepperItem
              key={number}
              step={number}
              disabled={number > step}
            >
              <StepperTrigger className="gap-2">
                <StepperIndicator className="size-7 rounded-full border-2 text-xs font-medium data-[state=inactive]:border-muted data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:border-primary data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground">
                  {number}
                </StepperIndicator>
                <StepperTitle className="data-[state=inactive]:text-muted-foreground data-[state=active]:text-foreground data-[state=completed]:text-primary">
                  {label}
                </StepperTitle>
              </StepperTrigger>
              {number < STEPS.length && (
                <StepperSeparator className="mx-2 w-8 data-[state=completed]:bg-primary" />
              )}
            </StepperItem>
          ))}
        </StepperNav>
      </Stepper>

      {/* ── Step 1: Template Selection ────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              Choose a starting point
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a template or start from scratch.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {CONTENT_TYPE_TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedTemplate?.id === template.id}
                onSelect={() => handleSelectTemplate(template)}
              />
            ))}

            <button
              type="button"
              onClick={handleStartFromScratch}
              className="text-left w-full"
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-md h-full ${
                  selectedTemplate === null
                    ? ""
                    : "hover:border-foreground/20"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Start from Scratch
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Build your own schema
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    Create a custom content type with your own fields and
                    configuration.
                  </p>
                </CardContent>
              </Card>
            </button>
          </div>

          {selectedTemplate && (
            <div className="flex justify-end">
              <Button onClick={handleContinueFromTemplate}>
                Continue with {selectedTemplate.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Name + Slug ─────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Name your content type</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose a name and URL slug for your content type.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ct-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ct-name"
                placeholder="e.g. Blog Post"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-slug">Slug</Label>
              <Input
                id="ct-slug"
                placeholder="e.g. blog-post"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from name. Edit to customize.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => goToStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleContinueToSchema}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Schema Builder ──────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Build your schema</CardTitle>
            <p className="text-sm text-muted-foreground">
              Define the fields for{" "}
              <span className="font-medium">{name || "your content type"}</span>.
            </p>
          </CardHeader>
          <CardContent>
            <SchemaBuilder
              initialFields={fields}
              onSave={handleSchemaSave}
              onCancel={handleSchemaCancel}
              saving={false}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Review + Create ─────────────────────────────── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; Create</CardTitle>
            <p className="text-sm text-muted-foreground">
              Confirm your content type details before creating.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Name
                </p>
                <p className="text-sm font-medium">{name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Slug
                </p>
                <p className="text-sm font-medium">{slug}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Fields
                </p>
                <Badge variant="secondary">{fields.length}</Badge>
              </div>
            </div>

            <Separator />

            {/* Field list */}
            {fields.length > 0 ? (
              <div className="space-y-3">
                {fields.map((field) => (
                  <div
                    key={field.uid}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <FieldTypeIcon
                      type={field.type}
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {getFieldLabel(field)}{" "}
                        <span className="text-muted-foreground">
                          ({field.type})
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getFieldSummary(field)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No fields defined. You can still create the content type and add
                fields later.
              </p>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => goToStep(3)}
                disabled={isCreating}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isCreating ? "Creating..." : "Create Content Type"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

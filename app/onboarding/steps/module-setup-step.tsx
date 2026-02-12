"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Loader2, SkipForward } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import type { ModuleConfig } from "../module-configs"

import { createFeatureFlag } from "@/lib/actions/feature-flags"
import { createChangelog } from "@/lib/actions/changelogs"
import { createGlobalConfig } from "@/lib/actions/global-configs"
import { createCustomer } from "@/lib/actions/customers"
import { createMediaFolder } from "@/lib/actions/media"

interface ModuleSetupStepProps {
  module: ModuleConfig
  stepNumber: number
  totalSteps: number
  onComplete: (moduleId: string, created: boolean) => void
  onBack: () => void
}

const formVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const fieldVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export function ModuleSetupStep({
  module,
  stepNumber,
  totalSteps,
  onComplete,
  onBack,
}: ModuleSetupStepProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const Icon = module.icon

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }))

    // Auto-generate key/slug from name for certain modules
    if (fieldName === "name") {
      const slugValue = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")

      if (module.id === "feature-flags") {
        setFormValues((prev) => ({ ...prev, key: prev.key || slugValue }))
      }
      if (module.id === "global-configs") {
        setFormValues((prev) => ({ ...prev, slug: prev.slug || slugValue }))
      }
    }
  }

  const handleCreate = async () => {
    setError(null)

    // Validate required fields
    const missingFields = module.fields?.filter(
      (f) => f.required && !formValues[f.name]?.trim()
    )
    if (missingFields && missingFields.length > 0) {
      setError(`${missingFields[0].label} is required`)
      return
    }

    setIsLoading(true)

    try {
      switch (module.id) {
        case "feature-flags":
          await createFeatureFlag({
            name: formValues.name.trim(),
            key: formValues.key.trim(),
            description: formValues.description?.trim() || null,
            enabled: false,
            environment: "production",
          })
          break

        case "changelogs":
          await createChangelog({
            title: formValues.title.trim(),
            version: formValues.version?.trim() || null,
            summary: formValues.summary?.trim() || null,
            content: null,
            status: "draft",
            publishedAt: null,
            deployedAt: null,
          })
          break

        case "global-configs":
          await createGlobalConfig({
            name: formValues.name.trim(),
            slug: formValues.slug.trim(),
            description: formValues.description?.trim() || null,
            data: {},
            environment: "production",
          })
          break

        case "customers":
          await createCustomer({
            name: formValues.name?.trim() || null,
            email: formValues.email?.trim() || null,
            externalId: null,
            metadata: {},
            userId: null,
          })
          break

        case "media":
          await createMediaFolder(formValues.name.trim())
          break

        default:
          break
      }

      onComplete(module.id, true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      )
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    onComplete(module.id, false)
  }

  // Modules without a backend setup show intro-only
  if (!module.hasSetup || !module.fields) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-xl">{module.title}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              Coming Soon
            </Badge>
          </div>
          <CardDescription className="mx-auto max-w-md">
            {module.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            This module is not yet available for setup. You&apos;ll be able to
            configure it once it&apos;s ready.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSkip} className="flex-1 gap-2" size="lg">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <Icon className="size-6" />
        </motion.div>
        <CardTitle className="text-xl">{module.title}</CardTitle>
        <CardDescription className="mx-auto max-w-md">
          {module.description}
        </CardDescription>
        <p className="pt-1 text-xs text-muted-foreground">
          Step {stepNumber} of {totalSteps}
        </p>
      </CardHeader>
      <CardContent>
        {/* Module intro separator */}
        <div className="mb-5 rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">{module.createLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Set up a quick example or skip to configure later.
          </p>
        </div>

        <motion.div variants={formVariants} initial="hidden" animate="show">
          <FieldGroup>
            {error && (
              <motion.div variants={fieldVariant}>
                <Field>
                  <p className="text-sm text-destructive">{error}</p>
                </Field>
              </motion.div>
            )}

            {module.fields.map((field) => (
              <motion.div key={field.name} variants={fieldVariant}>
                <Field>
                  <FieldLabel htmlFor={`setup-${field.name}`}>
                    {field.label}
                    {field.required && (
                      <span className="text-destructive"> *</span>
                    )}
                  </FieldLabel>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={`setup-${field.name}`}
                      placeholder={field.placeholder}
                      value={formValues[field.name] || ""}
                      onChange={(e) =>
                        handleFieldChange(field.name, e.target.value)
                      }
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={`setup-${field.name}`}
                      placeholder={field.placeholder}
                      value={formValues[field.name] || ""}
                      onChange={(e) =>
                        handleFieldChange(field.name, e.target.value)
                      }
                    />
                  )}
                </Field>
              </motion.div>
            ))}

            <motion.div
              variants={fieldVariant}
              className="flex items-center gap-3 pt-2"
            >
              <Button variant="outline" onClick={onBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="gap-2 text-muted-foreground"
              >
                Skip
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isLoading}
                className="flex-1 gap-2"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create & Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </FieldGroup>
        </motion.div>
      </CardContent>
    </Card>
  )
}

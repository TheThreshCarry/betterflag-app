"use client"

import { useState } from "react"
import { ImageIcon, Loader2, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { authClient } from "@/lib/auth/auth-client"

interface OnboardingFormProps {
  userName: string
  className?: string
  onOrgCreated?: (orgId: string, description: string) => void
}

export function OnboardingForm({
  userName,
  className,
  onOrgCreated,
}: OnboardingFormProps) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [logo, setLogo] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-generate slug from name if slug hasn't been manually edited
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
      )
    }
  }

  const handleSlugChange = (value: string) => {
    setSlugTouched(true)
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Organization name is required")
      return
    }

    if (!slug.trim()) {
      setError("Slug is required")
      return
    }

    if (slug.length < 3) {
      setError("Slug must be at least 3 characters")
      return
    }

    setIsLoading(true)

    try {
      const result = await authClient.organization.create({
        name: name.trim(),
        slug: slug.trim(),
        logo: logo.trim() || undefined,
        metadata: description.trim()
          ? JSON.stringify({ description: description.trim() })
          : undefined,
      })

      if (result.error) {
        setError(result.error.message || "Failed to create organization")
        setIsLoading(false)
        return
      }

      // Set the new org as active
      if (result.data?.id) {
        await authClient.organization.setActive({
          organizationId: result.data.id,
        })

        // Call the callback if provided (wizard mode)
        if (onOrgCreated) {
          onOrgCreated(result.data.id, description.trim())
        }
      }
    } catch {
      setError("Something went wrong. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Card>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {userName.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Set up your organization to get started with ShipOS
          </p>
        </div>
        <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error && (
                <Field>
                  <p className="text-sm text-destructive">{error}</p>
                </Field>
              )}

              {/* Logo preview + URL */}
              <Field>
                <FieldLabel>Logo</FieldLabel>
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted">
                    {logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={logo}
                        alt="Organization logo"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Input
                      placeholder="https://example.com/logo.png"
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                    />
                    <FieldDescription>
                      Paste a URL to your logo image (optional)
                    </FieldDescription>
                  </div>
                </div>
              </Field>

              {/* Organization name */}
              <Field>
                <FieldLabel htmlFor="org-name">Organization Name</FieldLabel>
                <Input
                  id="org-name"
                  placeholder="Acme Inc."
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
                <FieldDescription>
                  Your company or team name
                </FieldDescription>
              </Field>

              {/* Slug */}
              <Field>
                <FieldLabel htmlFor="org-slug">Slug</FieldLabel>
                <div className="flex items-center gap-0">
                  <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                    shipos.app/
                  </span>
                  <Input
                    id="org-slug"
                    className="rounded-l-none"
                    placeholder="acme"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                  />
                </div>
                <FieldDescription>
                  URL-friendly identifier, auto-generated from name
                </FieldDescription>
              </Field>

              {/* Description */}
              <Field>
                <FieldLabel htmlFor="org-description">Description</FieldLabel>
                <Textarea
                  id="org-description"
                  placeholder="What does your organization do?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <FieldDescription>
                  A short description of your organization (optional)
                </FieldDescription>
              </Field>

              {/* Submit */}
              <Field>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </Field>
            </FieldGroup>
          </form>
    </div>
  )
}

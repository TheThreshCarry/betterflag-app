"use client"

import { useEffect, useState } from "react"
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
import {
  createOrganization,
  updateOrganization,
} from "@/lib/actions/organizations"
import { setActiveOrganization } from "@/lib/actions/profile"

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
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

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
      const org = await createOrganization({
        name: name.trim(),
        slug: slug.trim(),
        logo: null,
        metadata: description.trim()
          ? { description: description.trim() }
          : {},
      })

      await setActiveOrganization(org.id)

      if (logoFile) {
        const formData = new FormData()
        formData.append("file", logoFile)
        const res = await fetch("/api/org-logo/upload", {
          method: "POST",
          body: formData,
        })
        const payload = (await res.json()) as { error?: string; url?: string }
        if (!res.ok) {
          throw new Error(payload.error || "Logo upload failed")
        }
        if (payload.url) {
          await updateOrganization({
            organizationId: org.id,
            logo: payload.url,
          })
        }
      }

      if (onOrgCreated) {
        onOrgCreated(org.id, description.trim())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowed.includes(file.type)) {
      setError("Logo must be JPEG, PNG, WebP, or GIF")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be 5MB or smaller")
      return
    }
    setError(null)
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
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

              <Field>
                <FieldLabel htmlFor="onboarding-org-logo">Logo</FieldLabel>
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted">
                    {logoPreview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={logoPreview}
                        alt="Organization logo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Input
                      id="onboarding-org-logo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={isLoading}
                      onChange={(e) => {
                        handleLogoFile(e.target.files?.[0])
                        e.target.value = ""
                      }}
                    />
                    <FieldDescription>
                      Optional. JPEG, PNG, WebP, or GIF up to 5MB.
                    </FieldDescription>
                    {logoPreview && (
                      <button
                        type="button"
                        className="text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline w-fit"
                        onClick={() => {
                          if (logoPreview) URL.revokeObjectURL(logoPreview)
                          setLogoPreview(null)
                          setLogoFile(null)
                        }}
                      >
                        Remove image
                      </button>
                    )}
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

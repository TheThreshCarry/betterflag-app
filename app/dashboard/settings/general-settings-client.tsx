"use client"

import { useState } from "react"
import {
  Save,
  Loader2,
  Trash2,
  ImageIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

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
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { authClient } from "@/lib/auth/auth-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Organization {
  id: string
  name: string
  slug: string
  logo: string | null
  description: string
  createdAt: string
}

interface GeneralSettingsClientProps {
  organization: Organization | null
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function GeneralSettingsClient({ organization }: GeneralSettingsClientProps) {
  const router = useRouter()

  // Fallback — DashboardLayout guarantees an org, but keep a guard just in case
  if (!organization) {
    return null
  }

  return <GeneralSettingsForm organization={organization} />
}

function GeneralSettingsForm({ organization }: { organization: Organization }) {
  const router = useRouter()
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [logo, setLogo] = useState(organization.logo ?? "")
  const [description, setDescription] = useState(organization.description)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Organization name is required")
      return
    }
    if (!slug.trim()) {
      toast.error("Organization slug is required")
      return
    }

    setSaving(true)
    try {
      // Build metadata with description
      const metadata = description.trim()
        ? JSON.stringify({ description: description.trim() })
        : undefined

      await authClient.organization.update({
        organizationId: organization.id,
        data: {
          name: name.trim(),
          slug: slug.trim(),
          logo: logo.trim() || undefined,
          metadata,
        },
      })
      toast.success("Organization settings updated")
      router.refresh()
    } catch {
      toast.error("Failed to update organization settings")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== organization.name) return

    setDeleting(true)
    try {
      await authClient.organization.delete({
        organizationId: organization.id,
      })
      toast.success("Organization deleted")
      router.push("/onboarding")
    } catch {
      toast.error("Failed to delete organization")
    } finally {
      setDeleting(false)
    }
  }

  const hasChanges =
    name !== organization.name ||
    slug !== organization.slug ||
    logo !== (organization.logo ?? "") ||
    description !== organization.description

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Organization Info</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization&apos;s identity and branding
          </p>
        </div>
      </div>
      
      <div className="space-y-6 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              placeholder="My Organization"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The display name for your organization
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              placeholder="my-organization"
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              URL-friendly identifier for your organization
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="org-logo">Logo</Label>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt="Organization logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="grid flex-1 gap-1.5">
              <Input
                id="org-logo"
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    setLogo((ev.target?.result as string) ?? "")
                  }
                  reader.readAsDataURL(file)
                }}
              />
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo("")}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline text-left w-fit"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload an image for your organization&apos;s logo
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="org-description">Description</Label>
          <Textarea
            id="org-description"
            placeholder="What does your organization do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            A short description of your organization
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Created on{" "}
            {new Date(organization.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-6 border-t">
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Irreversible and destructive actions
          </p>
        </div>
        
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 max-w-2xl">
          <div>
            <p className="font-medium text-destructive">Delete Organization</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Permanently delete this organization, all its data, and remove
              all members. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. All data associated
              with <strong>{organization.name}</strong> will be permanently
              deleted, including all members, configurations, feature flags, and
              changelogs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-4">
            <Label>
              Type <strong>{organization.name}</strong> to confirm
            </Label>
            <Input
              placeholder={organization.name}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirm !== organization.name || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Organization"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

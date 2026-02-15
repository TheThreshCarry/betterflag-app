"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, Trash2, Settings, Loader2, ArrowRight, Pencil } from "lucide-react"
import type { ContentType } from "@/lib/db/schema"
import {
  deleteContentType,
  setContentTypeStatus,
} from "@/lib/actions/content-types"
import { parseSchemaFields } from "@/lib/cms/schema-utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_BADGE_VARIANT: Record<
  string,
  "outline" | "default" | "secondary"
> = {
  draft: "outline",
  active: "default",
  deprecated: "secondary",
}

interface ContentTypesClientProps {
  contentTypes: ContentType[]
}

export function ContentTypesClient({
  contentTypes: initialContentTypes,
}: ContentTypesClientProps) {
  const router = useRouter()

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ContentType | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Status update loading
  const [statusLoading, setStatusLoading] = useState<string | null>(null)

  async function handleDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await deleteContentType(deleteTarget.id)
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete content type"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleStatusChange(
    id: string,
    status: "draft" | "active" | "deprecated"
  ) {
    setStatusLoading(id)
    try {
      await setContentTypeStatus(id, status)
      toast.success("Status updated")
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update status"
      )
    } finally {
      setStatusLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Content Types</h1>
        <Button asChild>
          <Link href="/dashboard/cms/content-types/new">
            <Plus className="mr-2 size-4" />
            New Content Type
          </Link>
        </Button>
      </div>

      {/* Content Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Content Types</CardTitle>
        </CardHeader>
        <CardContent>
          {initialContentTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings className="text-muted-foreground mb-4 size-12" />
              <h3 className="text-lg font-medium">No content types yet</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Create your first content type to start defining your CMS
                schema.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                asChild
              >
                <Link href="/dashboard/cms/content-types/new">
                  <Plus className="mr-2 size-4" />
                  Create Content Type
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialContentTypes.map((ct) => {
                  const fields = parseSchemaFields(ct.schema)
                  return (
                    <TableRow key={ct.id}>
                      <TableCell className="font-medium">{ct.name}</TableCell>
                      <TableCell>
                        <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                          {ct.slug}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {fields.length} {fields.length === 1 ? "field" : "fields"}
                        </Badge>
                      </TableCell>
                      <TableCell>v{ct.version}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              STATUS_BADGE_VARIANT[ct.status ?? "draft"] ??
                              "outline"
                            }
                          >
                            {ct.status ?? "draft"}
                          </Badge>
                          <Select
                            value={ct.status ?? "draft"}
                            onValueChange={(value) =>
                              handleStatusChange(
                                ct.id,
                                value as "draft" | "active" | "deprecated"
                              )
                            }
                            disabled={statusLoading === ct.id}
                          >
                            <SelectTrigger size="sm" className="h-7 w-28">
                              {statusLoading === ct.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="deprecated">
                                Deprecated
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(ct.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link
                              href={`/dashboard/cms/content-types/${ct.id}/schema`}
                            >
                              <Pencil className="mr-1 size-3" />
                              Edit Schema
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/cms/content-types/${ct.id}`
                              )
                            }
                          >
                            Edit
                            <ArrowRight className="ml-1 size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(ct)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone and will remove all associated entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

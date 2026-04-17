"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Sparkles, Send, RotateCcw, Rocket, CloudOff, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

import type { Changelog, ChangelogLabel } from "@/lib/db/schema"
import {
  deleteChangelog,
  publishChangelog,
  unpublishChangelog,
  deployChangelog,
  undeployChangelog,
} from "@/lib/actions/changelogs"

interface ChangelogsClientProps {
  initialEntries: Changelog[]
  labels: ChangelogLabel[]
}

export function ChangelogsClient({
  initialEntries,
  labels,
}: ChangelogsClientProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<Changelog[]>(initialEntries)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Changelog | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (!selectedEntry) return

    setIsLoading(true)
    try {
      await deleteChangelog(selectedEntry.id)
      setEntries(entries.filter((e) => e.id !== selectedEntry.id))
      setIsDeleteOpen(false)
      setSelectedEntry(null)
      toast.success("Changelog entry deleted")
    } catch {
      toast.error("Failed to delete changelog entry")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePublish = async (entry: Changelog) => {
    try {
      const updated = await publishChangelog(entry.id)
      setEntries(entries.map((e) => (e.id === entry.id ? updated : e)))
      toast.success("Changelog published")
    } catch {
      toast.error("Failed to publish changelog")
    }
  }

  const handleUnpublish = async (entry: Changelog) => {
    try {
      const updated = await unpublishChangelog(entry.id)
      setEntries(entries.map((e) => (e.id === entry.id ? updated : e)))
      toast.success("Changelog reverted to draft")
    } catch {
      toast.error("Failed to unpublish changelog")
    }
  }

  const handleDeploy = async (entry: Changelog) => {
    try {
      const updated = await deployChangelog(entry.id)
      setEntries(
        entries.map((e) =>
          e.id === entry.id ? updated : { ...e, deployedAt: null }
        )
      )
      toast.success("Version deployed — this is now the live version")
    } catch {
      toast.error("Failed to deploy changelog")
    }
  }

  const handleUndeploy = async (entry: Changelog) => {
    try {
      const updated = await undeployChangelog(entry.id)
      setEntries(entries.map((e) => (e.id === entry.id ? updated : e)))
      toast.success("Version undeployed")
    } catch {
      toast.error("Failed to undeploy changelog")
    }
  }

  const openDeleteDialog = (entry: Changelog) => {
    setSelectedEntry(entry)
    setIsDeleteOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Changelogs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish and manage version releases for your application
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/changelogs/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Release
        </Button>
      </div>

      <div>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No releases yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Create your first changelog release to get started and keep your users informed.
            </p>
            <Button
              className="mt-6"
              onClick={() => router.push("/dashboard/changelogs/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Release
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <ContextMenu key={entry.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow className={`py-2 hover:bg-muted/50 ${entry.deployedAt ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.title}</div>
                          {entry.summary && (
                            <div className="text-sm text-muted-foreground truncate max-w-md">
                              {entry.summary}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.version ? (
                          <span className="font-mono text-sm text-muted-foreground">
                            v{entry.version}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.publishedAt
                          ? new Date(entry.publishedAt).toLocaleDateString()
                          : new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              entry.status === "published"
                                ? "default"
                                : entry.status === "archived"
                                  ? "muted"
                                  : "outline"
                            }
                            className="font-normal"
                          >
                            {entry.status}
                          </Badge>
                          {entry.deployedAt && (
                            <Badge
                              variant="default"
                              className="bg-emerald-600 hover:bg-emerald-600 font-normal"
                            >
                              live
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {entry.status === "published" && !entry.deployedAt && (
                              <DropdownMenuItem onClick={() => handleDeploy(entry)}>
                                <Rocket className="mr-2 h-4 w-4" />
                                Deploy as Live
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/dashboard/changelogs/${entry.id}/edit`)
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {entry.status === "draft" ? (
                              <DropdownMenuItem onClick={() => handlePublish(entry)}>
                                <Send className="mr-2 h-4 w-4" />
                                Publish
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleUnpublish(entry)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Revert to Draft
                              </DropdownMenuItem>
                            )}

                            {entry.deployedAt && (
                              <DropdownMenuItem onClick={() => handleUndeploy(entry)}>
                                <CloudOff className="mr-2 h-4 w-4" />
                                Undeploy
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openDeleteDialog(entry)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    {entry.status === "published" && !entry.deployedAt && (
                      <ContextMenuItem
                        onClick={() => handleDeploy(entry)}
                      >
                        <Rocket className="mr-2 h-4 w-4 " />
                        Deploy as Live
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem
                      onClick={() =>
                        router.push(`/dashboard/changelogs/${entry.id}/edit`)
                      }
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    {entry.status === "draft" ? (
                      <ContextMenuItem onClick={() => handlePublish(entry)}>
                        <Send className="mr-2 h-4 w-4" />
                        Publish
                      </ContextMenuItem>
                    ) : (
                      <ContextMenuItem onClick={() => handleUnpublish(entry)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Revert to Draft
                      </ContextMenuItem>
                    )}

                    {entry.deployedAt && (
                      <ContextMenuItem onClick={() => handleUndeploy(entry)}>
                        <CloudOff className="mr-2 h-4 w-4 text-amber-500" />
                        Undeploy
                      </ContextMenuItem>
                    )}

                    <ContextMenuSeparator />

                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => openDeleteDialog(entry)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Changelog Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedEntry?.title}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

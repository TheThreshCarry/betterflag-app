"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Tag } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import type { ChangelogLabel } from "@/lib/db/schema"
import {
  createChangelogLabel,
  updateChangelogLabel,
  deleteChangelogLabel,
} from "@/lib/actions/changelog-labels"

interface LabelsClientProps {
  initialLabels: ChangelogLabel[]
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
]

export function LabelsClient({ initialLabels }: LabelsClientProps) {
  const [labels, setLabels] = useState<ChangelogLabel[]>(initialLabels)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<ChangelogLabel | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    color: "#3b82f6",
  })

  const resetForm = () => {
    setFormData({ name: "", color: "#3b82f6" })
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Label name is required")
      return
    }

    setIsLoading(true)
    try {
      const label = await createChangelogLabel(formData)
      setLabels([label, ...labels])
      setIsCreateOpen(false)
      resetForm()
      toast.success("Label created")
    } catch {
      toast.error("Failed to create label")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedLabel || !formData.name.trim()) return

    setIsLoading(true)
    try {
      const updated = await updateChangelogLabel(selectedLabel.id, formData)
      setLabels(labels.map((l) => (l.id === selectedLabel.id ? updated : l)))
      setIsEditOpen(false)
      setSelectedLabel(null)
      resetForm()
      toast.success("Label updated")
    } catch {
      toast.error("Failed to update label")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedLabel) return

    setIsLoading(true)
    try {
      await deleteChangelogLabel(selectedLabel.id)
      setLabels(labels.filter((l) => l.id !== selectedLabel.id))
      setIsDeleteOpen(false)
      setSelectedLabel(null)
      toast.success("Label deleted")
    } catch {
      toast.error("Failed to delete label")
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (label: ChangelogLabel) => {
    setSelectedLabel(label)
    setFormData({ name: label.name, color: label.color })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (label: ChangelogLabel) => {
    setSelectedLabel(label)
    setIsDeleteOpen(true)
  }

  const ColorPicker = () => (
    <div className="space-y-2">
      <Label>Color</Label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`h-8 w-8 rounded-full border-2 transition-all ${
              formData.color === color
                ? "border-foreground scale-110"
                : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setFormData({ ...formData, color })}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Input
          type="color"
          value={formData.color}
          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          className="h-8 w-12 p-0.5 cursor-pointer"
        />
        <Input
          value={formData.color}
          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          placeholder="#000000"
          className="font-mono text-sm"
        />
      </div>
    </div>
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Changelog Labels</CardTitle>
                <CardDescription>
                  Manage labels to categorize your changelog entries
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Label
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {labels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Tag className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No labels yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create labels like &quot;Feature&quot;, &quot;Bug Fix&quot;, or &quot;Improvement&quot;
              </p>
              <Button className="mt-4" onClick={() => { resetForm(); setIsCreateOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Label
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labels.map((label) => (
                  <TableRow key={label.id}>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: label.color,
                          color: "#fff",
                        }}
                      >
                        {label.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="font-mono text-sm text-muted-foreground">
                          {label.color}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(label.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(label)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(label)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Label</DialogTitle>
            <DialogDescription>
              Add a new label for categorizing changelog entries
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Feature, Bug Fix, Improvement"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <ColorPicker />
            <div className="space-y-1">
              <Label>Preview</Label>
              <div>
                <Badge
                  style={{
                    backgroundColor: formData.color,
                    color: "#fff",
                  }}
                >
                  {formData.name || "Label"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Label"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
            <DialogDescription>
              Update the label name and color
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <ColorPicker />
            <div className="space-y-1">
              <Label>Preview</Label>
              <div>
                <Badge
                  style={{
                    backgroundColor: formData.color,
                    color: "#fff",
                  }}
                >
                  {formData.name || "Label"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Label</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the label &quot;{selectedLabel?.name}
              &quot;? It will be removed from all changelog entries.
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
    </>
  )
}

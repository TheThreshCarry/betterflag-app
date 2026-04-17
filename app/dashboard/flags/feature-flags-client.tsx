"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Flag } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { FeatureFlag } from "@/lib/db/schema"
import {
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlag,
} from "@/lib/actions/feature-flags"

interface FeatureFlagsClientProps {
  initialFlags: FeatureFlag[]
}

const ENVIRONMENTS = ["production", "staging", "development"] as const

export function FeatureFlagsClient({ initialFlags }: FeatureFlagsClientProps) {
  const router = useRouter()
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    description: "",
    environment: "production" as string,
    enabled: false,
  })

  const resetForm = () => {
    setFormData({
      key: "",
      name: "",
      description: "",
      environment: "production",
      enabled: false,
    })
  }

  const handleCreate = async () => {
    if (!formData.key || !formData.name) {
      toast.error("Key and name are required")
      return
    }

    setIsLoading(true)
    try {
      const newFlag = await createFeatureFlag(formData)
      setFlags([newFlag, ...flags])
      setIsCreateOpen(false)
      resetForm()
      toast.success("Feature flag created successfully")
    } catch (error) {
      toast.error("Failed to create feature flag")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedFlag) return

    setIsLoading(true)
    try {
      const updatedFlag = await updateFeatureFlag(selectedFlag.id, formData)
      setFlags(flags.map((f) => (f.id === selectedFlag.id ? updatedFlag : f)))
      setIsEditOpen(false)
      setSelectedFlag(null)
      resetForm()
      toast.success("Feature flag updated successfully")
    } catch (error) {
      toast.error("Failed to update feature flag")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedFlag) return

    setIsLoading(true)
    try {
      await deleteFeatureFlag(selectedFlag.id)
      setFlags(flags.filter((f) => f.id !== selectedFlag.id))
      setIsDeleteOpen(false)
      setSelectedFlag(null)
      toast.success("Feature flag deleted successfully")
    } catch (error) {
      toast.error("Failed to delete feature flag")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (flag: FeatureFlag, enabled: boolean) => {
    try {
      const updatedFlag = await toggleFeatureFlag(flag.id, enabled)
      setFlags(flags.map((f) => (f.id === flag.id ? updatedFlag : f)))
      toast.success(`Flag ${enabled ? "enabled" : "disabled"}`)
    } catch (error) {
      toast.error("Failed to toggle feature flag")
    }
  }

  const openEditDialog = (flag: FeatureFlag) => {
    setSelectedFlag(flag)
    setFormData({
      key: flag.key,
      name: flag.name,
      description: flag.description || "",
      environment: flag.environment,
      enabled: flag.enabled,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (flag: FeatureFlag) => {
    setSelectedFlag(flag)
    setIsDeleteOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Feature Flags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage feature flags for your application
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Flag
        </Button>
      </div>

      <div>
        {flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Flag className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No feature flags</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Create your first feature flag to get started controlling access to new features.
            </p>
            <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Flag
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Status</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow
                  key={flag.id}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/dashboard/flags/${flag.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => handleToggle(flag, checked)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{flag.key}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{flag.name}</div>
                      {flag.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {flag.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        flag.environment === "production"
                          ? "default"
                          : flag.environment === "staging"
                          ? "muted"
                          : "outline"
                      }
                      className="font-normal"
                    >
                      {flag.environment}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(flag.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(flag)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(flag)}
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
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
            <DialogDescription>
              Add a new feature flag to control features in your application
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="e.g., enable_new_checkout"
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier used in your code
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., New Checkout Flow"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="environment">Environment</Label>
              <Select
                value={formData.environment}
                onValueChange={(value) =>
                  setFormData({ ...formData, environment: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env.charAt(0).toUpperCase() + env.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
              <Label htmlFor="enabled">Enabled by default</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Feature Flag</DialogTitle>
            <DialogDescription>
              Update the feature flag settings
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-key">Key</Label>
              <Input
                id="edit-key"
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
              />
            </div>
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
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-environment">Environment</Label>
              <Select
                value={formData.environment}
                onValueChange={(value) =>
                  setFormData({ ...formData, environment: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env.charAt(0).toUpperCase() + env.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
              <Label htmlFor="edit-enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleEdit} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature Flag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the flag &quot;{selectedFlag?.name}&quot;?
              This action cannot be undone.
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
  )
}

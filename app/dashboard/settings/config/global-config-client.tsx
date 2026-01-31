"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Settings, Code, Eye } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { GlobalConfig } from "@/lib/db/schema"
import {
  createGlobalConfig,
  updateGlobalConfig,
  deleteGlobalConfig,
} from "@/lib/actions/global-configs"

interface GlobalConfigClientProps {
  initialConfigs: GlobalConfig[]
}

const ENVIRONMENTS = ["production", "staging", "development"] as const

export function GlobalConfigClient({ initialConfigs }: GlobalConfigClientProps) {
  const [configs, setConfigs] = useState<GlobalConfig[]>(initialConfigs)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<GlobalConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    description: "",
    environment: "production" as string,
    data: "{}",
  })

  const resetForm = () => {
    setFormData({
      slug: "",
      name: "",
      description: "",
      environment: "production",
      data: "{}",
    })
    setJsonError(null)
  }

  const validateJson = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString)
      setJsonError(null)
      return true
    } catch (e) {
      setJsonError("Invalid JSON format")
      return false
    }
  }

  const handleCreate = async () => {
    if (!formData.slug || !formData.name) {
      toast.error("Slug and name are required")
      return
    }

    if (!validateJson(formData.data)) {
      return
    }

    setIsLoading(true)
    try {
      const newConfig = await createGlobalConfig({
        ...formData,
        data: JSON.parse(formData.data),
      })
      setConfigs([newConfig, ...configs])
      setIsCreateOpen(false)
      resetForm()
      toast.success("Config created successfully")
    } catch (error) {
      toast.error("Failed to create config")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedConfig) return

    if (!validateJson(formData.data)) {
      return
    }

    setIsLoading(true)
    try {
      const updatedConfig = await updateGlobalConfig(selectedConfig.id, {
        ...formData,
        data: JSON.parse(formData.data),
      })
      setConfigs(configs.map((c) => (c.id === selectedConfig.id ? updatedConfig : c)))
      setIsEditOpen(false)
      setSelectedConfig(null)
      resetForm()
      toast.success("Config updated successfully")
    } catch (error) {
      toast.error("Failed to update config")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedConfig) return

    setIsLoading(true)
    try {
      await deleteGlobalConfig(selectedConfig.id)
      setConfigs(configs.filter((c) => c.id !== selectedConfig.id))
      setIsDeleteOpen(false)
      setSelectedConfig(null)
      toast.success("Config deleted successfully")
    } catch (error) {
      toast.error("Failed to delete config")
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (config: GlobalConfig) => {
    setSelectedConfig(config)
    setFormData({
      slug: config.slug,
      name: config.name,
      description: config.description || "",
      environment: config.environment,
      data: JSON.stringify(config.data, null, 2),
    })
    setJsonError(null)
    setIsEditOpen(true)
  }

  const openDeleteDialog = (config: GlobalConfig) => {
    setSelectedConfig(config)
    setIsDeleteOpen(true)
  }

  const openViewDialog = (config: GlobalConfig) => {
    setSelectedConfig(config)
    setIsViewOpen(true)
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(formData.data)
      setFormData({ ...formData, data: JSON.stringify(parsed, null, 2) })
      setJsonError(null)
    } catch (e) {
      setJsonError("Invalid JSON - cannot format")
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Global Configuration</CardTitle>
                <CardDescription>
                  Manage global configurations for your application (pricing, legal, etc.)
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Config
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No configurations</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first config to get started
              </p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Config
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-mono text-sm">{config.slug}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{config.name}</div>
                        {config.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {config.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          config.environment === "production"
                            ? "default"
                            : config.environment === "staging"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {config.environment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(config.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewDialog(config)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(config)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(config)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Global Config</DialogTitle>
            <DialogDescription>
              Add a new configuration to store JSON data for your application
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="data">JSON Data</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="e.g., pricing, legal, settings"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s/g, "-") })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier used in API calls
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Pricing Configuration"
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
              </div>
            </TabsContent>
            <TabsContent value="data" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="data">JSON Data</Label>
                  <Button variant="outline" size="sm" onClick={formatJson}>
                    <Code className="mr-2 h-4 w-4" />
                    Format JSON
                  </Button>
                </div>
                <Textarea
                  id="data"
                  className="font-mono min-h-[300px]"
                  placeholder='{"key": "value"}'
                  value={formData.data}
                  onChange={(e) => {
                    setFormData({ ...formData, data: e.target.value })
                    if (jsonError) validateJson(e.target.value)
                  }}
                />
                {jsonError && (
                  <p className="text-sm text-destructive">{jsonError}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Config"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Global Config</DialogTitle>
            <DialogDescription>
              Update the configuration settings
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="data">JSON Data</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-slug">Slug</Label>
                  <Input
                    id="edit-slug"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s/g, "-") })
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
              </div>
            </TabsContent>
            <TabsContent value="data" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-data">JSON Data</Label>
                  <Button variant="outline" size="sm" onClick={formatJson}>
                    <Code className="mr-2 h-4 w-4" />
                    Format JSON
                  </Button>
                </div>
                <Textarea
                  id="edit-data"
                  className="font-mono min-h-[300px]"
                  value={formData.data}
                  onChange={(e) => {
                    setFormData({ ...formData, data: e.target.value })
                    if (jsonError) validateJson(e.target.value)
                  }}
                />
                {jsonError && (
                  <p className="text-sm text-destructive">{jsonError}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
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

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedConfig?.name}</DialogTitle>
            <DialogDescription>
              {selectedConfig?.description || "No description"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Slug:</span>{" "}
                <code className="rounded bg-muted px-2 py-1">
                  {selectedConfig?.slug}
                </code>
              </div>
              <div>
                <span className="text-muted-foreground">Environment:</span>{" "}
                <Badge
                  variant={
                    selectedConfig?.environment === "production"
                      ? "default"
                      : selectedConfig?.environment === "staging"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {selectedConfig?.environment}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">JSON Data</Label>
              <pre className="rounded-lg bg-muted p-4 overflow-auto max-h-[400px] text-sm">
                <code>
                  {JSON.stringify(selectedConfig?.data, null, 2)}
                </code>
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewOpen(false)
                if (selectedConfig) openEditDialog(selectedConfig)
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the config &quot;{selectedConfig?.name}&quot;?
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
    </>
  )
}

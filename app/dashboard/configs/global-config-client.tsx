"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Settings, Code, Eye, GripVertical, FileJson } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

import type { GlobalConfig } from "@/lib/db/schema"
import {
  createGlobalConfig,
  updateGlobalConfig,
  deleteGlobalConfig,
} from "@/lib/actions/global-configs"

interface GlobalConfigClientProps {
  initialConfigs: GlobalConfig[]
  selectedId?: string
}

interface ConfigField {
  id: string
  key: string
  value: string
  type: "string" | "number" | "boolean" | "json"
}

const ENVIRONMENTS = ["production", "staging", "development"] as const

// Helper to detect value type
function detectValueType(value: unknown): ConfigField["type"] {
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (typeof value === "object") return "json"
  return "string"
}

// Helper to parse value based on type
function parseValue(value: string, type: ConfigField["type"]): unknown {
  switch (type) {
    case "number":
      return Number(value) || 0
    case "boolean":
      return value === "true"
    case "json":
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    default:
      return value
  }
}

// Helper to stringify value for display
function stringifyValue(value: unknown): string {
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// Convert JSON object to fields array
function jsonToFields(data: Record<string, unknown>): ConfigField[] {
  return Object.entries(data).map(([key, value]) => ({
    id: crypto.randomUUID(),
    key,
    value: stringifyValue(value),
    type: detectValueType(value),
  }))
}

// Convert fields array to JSON object
function fieldsToJson(fields: ConfigField[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.key.trim()) {
      result[field.key] = parseValue(field.value, field.type)
    }
  }
  return result
}

export function GlobalConfigClient({ initialConfigs, selectedId }: GlobalConfigClientProps) {
  const [configs, setConfigs] = useState<GlobalConfig[]>(initialConfigs)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<GlobalConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<"fields" | "json">("fields")

  // Form state
  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    description: "",
    environment: "production" as string,
    data: "{}",
  })

  // Fields state for visual editor
  const [fields, setFields] = useState<ConfigField[]>([])

  const resetForm = () => {
    setFormData({
      slug: "",
      name: "",
      description: "",
      environment: "production",
      data: "{}",
    })
    setFields([])
    setJsonError(null)
    setEditorMode("fields")
  }

  // Sync fields to JSON when fields change
  const syncFieldsToJson = useCallback(() => {
    const json = fieldsToJson(fields)
    setFormData((prev) => ({ ...prev, data: JSON.stringify(json, null, 2) }))
    setJsonError(null)
  }, [fields])

  // Sync JSON to fields when switching to fields mode
  const syncJsonToFields = useCallback(() => {
    try {
      const parsed = JSON.parse(formData.data)
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        setFields(jsonToFields(parsed))
        setJsonError(null)
      } else {
        setJsonError("JSON must be an object (not array or primitive)")
      }
    } catch {
      setJsonError("Invalid JSON - cannot switch to field editor")
    }
  }, [formData.data])

  // Handle mode switch
  const handleModeSwitch = (mode: "fields" | "json") => {
    if (mode === "fields" && editorMode === "json") {
      syncJsonToFields()
    } else if (mode === "json" && editorMode === "fields") {
      syncFieldsToJson()
    }
    setEditorMode(mode)
  }

  // Auto-open view dialog if selectedId is provided
  useEffect(() => {
    if (selectedId) {
      const config = configs.find((c) => c.id === selectedId)
      if (config) {
        openViewDialog(config)
      }
    }
  }, [selectedId, configs])

  const validateJson = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString)
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonError("JSON must be an object")
        return false
      }
      setJsonError(null)
      return true
    } catch {
      setJsonError("Invalid JSON format")
      return false
    }
  }

  const handleCreate = async () => {
    if (!formData.slug || !formData.name) {
      toast.error("Slug and name are required")
      return
    }

    // Sync fields to JSON if in fields mode
    let finalData = formData.data
    if (editorMode === "fields") {
      const json = fieldsToJson(fields)
      finalData = JSON.stringify(json)
    }

    if (!validateJson(finalData)) {
      return
    }

    setIsLoading(true)
    try {
      const newConfig = await createGlobalConfig({
        ...formData,
        data: JSON.parse(finalData),
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

    // Sync fields to JSON if in fields mode
    let finalData = formData.data
    if (editorMode === "fields") {
      const json = fieldsToJson(fields)
      finalData = JSON.stringify(json)
    }

    if (!validateJson(finalData)) {
      return
    }

    setIsLoading(true)
    try {
      const updatedConfig = await updateGlobalConfig(selectedConfig.id, {
        ...formData,
        data: JSON.parse(finalData),
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
    const data = config.data as Record<string, unknown>
    setFormData({
      slug: config.slug,
      name: config.name,
      description: config.description || "",
      environment: config.environment,
      data: JSON.stringify(data, null, 2),
    })
    setFields(jsonToFields(data))
    setJsonError(null)
    setEditorMode("fields")
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
    } catch {
      setJsonError("Invalid JSON - cannot format")
    }
  }

  // Field operations
  const addField = () => {
    setFields([
      ...fields,
      { id: crypto.randomUUID(), key: "", value: "", type: "string" },
    ])
  }

  const updateField = (id: string, updates: Partial<ConfigField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id))
  }

  // Inline field editor JSX to avoid re-render focus issues
  const fieldEditorContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Configuration Fields</Label>
        <Button variant="outline" size="sm" onClick={addField} type="button">
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>
      
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
          <FileJson className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No fields yet</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={addField} type="button">
            <Plus className="mr-2 h-4 w-4" />
            Add your first field
          </Button>
        </div>
      ) : (
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.id} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-center h-9 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1 grid gap-2">
                  <div className="grid grid-cols-[1fr,120px] gap-2">
                    <Input
                      placeholder="Field name"
                      value={field.key}
                      onChange={(e) => updateField(field.id, { key: e.target.value })}
                      className="font-mono text-sm"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(value: ConfigField["type"]) =>
                        updateField(field.id, { type: value })
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {field.type === "boolean" ? (
                    <div className="flex items-center gap-3 h-9">
                      <Switch
                        checked={field.value === "true"}
                        onCheckedChange={(checked) => updateField(field.id, { value: checked ? "true" : "false" })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {field.value === "true" ? "true" : "false"}
                      </span>
                    </div>
                  ) : field.type === "json" ? (
                    <Textarea
                      placeholder='{"nested": "value"}'
                      value={field.value}
                      onChange={(e) => updateField(field.id, { value: e.target.value })}
                      className="font-mono text-sm min-h-[80px]"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                    />
                  ) : (
                    <Input
                      placeholder={field.type === "number" ? "0" : "Value"}
                      type={field.type === "number" ? "number" : "text"}
                      value={field.value}
                      onChange={(e) => updateField(field.id, { value: e.target.value })}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeField(field.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )

  // Inline JSON editor JSX
  const jsonEditorContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="json-data">Raw JSON</Label>
        <Button variant="outline" size="sm" onClick={formatJson} type="button">
          <Code className="mr-2 h-4 w-4" />
          Format
        </Button>
      </div>
      <Textarea
        id="json-data"
        className="font-mono min-h-[300px] text-sm"
        placeholder='{"key": "value"}'
        value={formData.data}
        onChange={(e) => {
          setFormData({ ...formData, data: e.target.value })
          if (jsonError) validateJson(e.target.value)
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-form-type="other"
        data-lpignore="true"
      />
      {jsonError && (
        <p className="text-sm text-destructive">{jsonError}</p>
      )}
    </div>
  )

  // Inline data editor tabs JSX
  const dataEditorTabsContent = (
    <Tabs value={editorMode} onValueChange={(v) => handleModeSwitch(v as "fields" | "json")} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="fields" className="gap-2">
          <Settings className="h-4 w-4" />
          Field Editor
        </TabsTrigger>
        <TabsTrigger value="json" className="gap-2">
          <Code className="h-4 w-4" />
          Raw JSON
        </TabsTrigger>
      </TabsList>
      <TabsContent value="fields" className="mt-4">
        {fieldEditorContent}
      </TabsContent>
      <TabsContent value="json" className="mt-4">
        {jsonEditorContent}
      </TabsContent>
    </Tabs>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Global Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage global configurations for your application (pricing, legal, etc.)
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Config
        </Button>
      </div>

      <div>
        {configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileJson className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No configurations</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Create your first config to manage global settings across your application.
            </p>
            <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
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
                <TableHead>Fields</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id} className="hover:bg-muted/50 group">
                  <TableCell className="font-mono text-sm text-muted-foreground">{config.slug}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{config.name}</div>
                      {config.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs mt-0.5">
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
                      className="font-normal"
                    >
                      {config.environment}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {Object.keys(config.data as object).length} fields
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(config.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Global Config</DialogTitle>
            <DialogDescription>
              Add a new configuration to store data for your application
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
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
              <TabsContent value="data" className="py-4">
                {dataEditorTabsContent}
              </TabsContent>
            </Tabs>
          </div>
          <Separator className="my-4" />
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
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Global Config</DialogTitle>
            <DialogDescription>
              Update the configuration settings
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
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
              <TabsContent value="data" className="py-4">
                {dataEditorTabsContent}
              </TabsContent>
            </Tabs>
          </div>
          <Separator className="my-4" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedConfig?.name}</DialogTitle>
            <DialogDescription>
              {selectedConfig?.description || "No description"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
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
            
            {/* Fields View */}
            <div>
              <Label className="mb-3 block">Configuration Fields</Label>
              <div className="space-y-2">
                {selectedConfig && Object.entries(selectedConfig.data as Record<string, unknown>).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-medium">{key}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {typeof value === "object" ? (
                          <pre className="bg-muted rounded p-2 overflow-auto text-xs">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          <span className={typeof value === "boolean" ? "text-blue-500" : typeof value === "number" ? "text-green-500" : ""}>
                            {String(value)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {typeof value === "object" ? "json" : typeof value}
                    </Badge>
                  </div>
                ))}
                {selectedConfig && Object.keys(selectedConfig.data as object).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No fields configured
                  </div>
                )}
              </div>
            </div>

            {/* Raw JSON View */}
            <div>
              <Label className="mb-2 block">Raw JSON</Label>
              <pre className="rounded-lg bg-muted p-4 overflow-auto max-h-[200px] text-sm font-mono">
                <code>
                  {JSON.stringify(selectedConfig?.data, null, 2)}
                </code>
              </pre>
            </div>
          </div>
          <Separator className="my-4" />
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
    </div>
  )
}

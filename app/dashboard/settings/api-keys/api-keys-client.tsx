"use client"

import { useState } from "react"
import { Plus, Trash2, Key, Copy, Check, Eye, EyeOff } from "lucide-react"
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

import type { ApiKey } from "@/lib/actions/api-keys"
import {
  createApiKey,
  deleteApiKey,
  toggleApiKey,
} from "@/lib/actions/api-keys"

interface ApiKeysClientProps {
  initialApiKeys: ApiKey[]
}

export function ApiKeysClient({ initialApiKeys }: ApiKeysClientProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isNewKeyOpen, setIsNewKeyOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyValue, setNewKeyValue] = useState("")
  const [showNewKey, setShowNewKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Name is required")
      return
    }

    setIsLoading(true)
    try {
      const result = await createApiKey(newKeyName)
      if (result) {
        setNewKeyValue(result.key)
        setIsCreateOpen(false)
        setIsNewKeyOpen(true)
        // Refresh the list
        const newKey: ApiKey = {
          id: result.id,
          name: newKeyName,
          start: result.key.slice(3, 11),
          prefix: "sk",
          enabled: true,
          createdAt: new Date(),
          expiresAt: null,
          lastRequest: null,
        }
        setApiKeys([newKey, ...apiKeys])
        setNewKeyName("")
        toast.success("API key created successfully")
      }
    } catch (error) {
      toast.error("Failed to create API key")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedKey) return

    setIsLoading(true)
    try {
      await deleteApiKey(selectedKey.id)
      setApiKeys(apiKeys.filter((k) => k.id !== selectedKey.id))
      setIsDeleteOpen(false)
      setSelectedKey(null)
      toast.success("API key deleted successfully")
    } catch (error) {
      toast.error("Failed to delete API key")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (key: ApiKey, enabled: boolean) => {
    try {
      await toggleApiKey(key.id, enabled)
      setApiKeys(apiKeys.map((k) => (k.id === key.id ? { ...k, enabled } : k)))
      toast.success(`API key ${enabled ? "enabled" : "disabled"}`)
    } catch (error) {
      toast.error("Failed to toggle API key")
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(newKeyValue)
      setCopied(true)
      toast.success("API key copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }

  const openDeleteDialog = (key: ApiKey) => {
    setSelectedKey(key)
    setIsDeleteOpen(true)
  }

  const closeNewKeyDialog = () => {
    setIsNewKeyOpen(false)
    setNewKeyValue("")
    setShowNewKey(false)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleDateString()
  }

  const maskKey = (prefix: string | null, start: string | null) => {
    if (!prefix || !start) return "••••••••••••"
    return `${prefix}_${start}••••••••`
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage API keys for accessing ShipOS from your applications
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No API keys</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first API key to start using the ShipOS SDK
              </p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <Switch
                        checked={key.enabled ?? false}
                        onCheckedChange={(checked) => handleToggle(key, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{key.name || "Unnamed"}</div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-sm">
                        {maskKey(key.prefix, key.start)}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.lastRequest)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(key)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key to access ShipOS from your applications
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production App, Development"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to identify this API key
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={isNewKeyOpen} onOpenChange={closeNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. You won&apos;t be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Your API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNewKey ? "text" : "password"}
                    value={newKeyValue}
                    readOnly
                    className="pr-10 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewKey(!showNewKey)}
                  >
                    {showNewKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-destructive">
                Make sure to copy your API key now. You won&apos;t be able to see it again!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={closeNewKeyDialog}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the API key &quot;{selectedKey?.name || "Unnamed"}&quot;?
              This action cannot be undone and any applications using this key will stop working.
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

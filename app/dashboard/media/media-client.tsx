"use client"

import { useState, useCallback, useRef } from "react"
import {
  Upload,
  FolderPlus,
  Grid3X3,
  List,
  Image as ImageIcon,
  Video,
  FileText,
  Folder,
  MoreHorizontal,
  Copy,
  Download,
  Trash2,
  ChevronRight,
  HardDrive,
  Loader2,
  Eye,
  FolderOpen,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
import { Separator } from "@/components/ui/separator"

import type { MediaAsset, MediaFolder } from "@/lib/db/schema"
import {
  getMediaAssets,
  getMediaFolders,
  deleteMediaAsset,
  createMediaFolder,
  deleteMediaFolder,
} from "@/lib/actions/media"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list"
type FilterType = "all" | "image" | "video" | "file"

interface MediaClientProps {
  initialAssets: MediaAsset[]
  initialFolders: MediaFolder[]
  storageUsage: { usedBytes: number; totalFiles: number }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getTypeIcon(type: string) {
  switch (type) {
    case "image":
      return <ImageIcon className="h-4 w-4" />
    case "video":
      return <Video className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

function getTypeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "image":
      return "default"
    case "video":
      return "secondary"
    default:
      return "outline"
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaClient({
  initialAssets,
  initialFolders,
  storageUsage,
}: MediaClientProps) {
  // State
  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets)
  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders)
  const [currentPath, setCurrentPath] = useState<string>("/")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [filter, setFilter] = useState<FilterType>("all")
  const [uploading, setUploading] = useState(false)
  const [usedBytes, setUsedBytes] = useState(storageUsage.usedBytes)
  const [totalFiles, setTotalFiles] = useState(storageUsage.totalFiles)

  // Dialog state
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [deleteAssetOpen, setDeleteAssetOpen] = useState(false)
  const [deletingAsset, setDeletingAsset] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null)

  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null)

  const [detailAsset, setDetailAsset] = useState<MediaAsset | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const navigateToFolder = useCallback(async (path: string) => {
    setCurrentPath(path)
    try {
      const [newAssets, newFolders] = await Promise.all([
        getMediaAssets(path, "all"),
        getMediaFolders(path),
      ])
      setAssets(newAssets)
      setFolders(newFolders)
      setFilter("all")
    } catch {
      toast.error("Failed to load folder contents")
    }
  }, [])

  const breadcrumbSegments = currentPath === "/"
    ? []
    : currentPath.slice(1, -1).split("/")

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  const handleFilterChange = useCallback(async (newFilter: string) => {
    const f = newFilter as FilterType
    setFilter(f)
    try {
      const newAssets = await getMediaAssets(currentPath, f)
      setAssets(newAssets)
    } catch {
      toast.error("Failed to filter assets")
    }
  }, [currentPath])

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    let successCount = 0
    let failCount = 0

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", currentPath)

        const response = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          failCount++
          toast.error(data.error || `Failed to upload ${file.name}`)
          continue
        }

        successCount++
        setAssets((prev) => [data.asset, ...prev])
        setUsedBytes((prev) => prev + file.size)
        setTotalFiles((prev) => prev + 1)
      } catch {
        failCount++
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "File uploaded successfully"
          : `${successCount} files uploaded successfully`
      )
    }
  }, [currentPath])

  // ---------------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------------

  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }, [handleUpload])

  // ---------------------------------------------------------------------------
  // Delete asset
  // ---------------------------------------------------------------------------

  const handleDeleteAsset = useCallback(async () => {
    if (!selectedAsset) return
    setDeletingAsset(true)
    try {
      await deleteMediaAsset(selectedAsset.id)
      setAssets((prev) => prev.filter((a) => a.id !== selectedAsset.id))
      setUsedBytes((prev) => prev - selectedAsset.size)
      setTotalFiles((prev) => prev - 1)
      toast.success("File deleted")
    } catch {
      toast.error("Failed to delete file")
    } finally {
      setDeletingAsset(false)
      setDeleteAssetOpen(false)
      setSelectedAsset(null)
    }
  }, [selectedAsset])

  // ---------------------------------------------------------------------------
  // Folder create
  // ---------------------------------------------------------------------------

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      const folder = await createMediaFolder(newFolderName, currentPath)
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Folder created")
      setNewFolderOpen(false)
      setNewFolderName("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create folder")
    } finally {
      setCreatingFolder(false)
    }
  }, [newFolderName, currentPath])

  // ---------------------------------------------------------------------------
  // Folder delete
  // ---------------------------------------------------------------------------

  const handleDeleteFolder = useCallback(async () => {
    if (!selectedFolder) return
    setDeletingFolder(true)
    try {
      await deleteMediaFolder(selectedFolder.id)
      setFolders((prev) => prev.filter((f) => f.id !== selectedFolder.id))
      toast.success("Folder deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder")
    } finally {
      setDeletingFolder(false)
      setDeleteFolderOpen(false)
      setSelectedFolder(null)
    }
  }, [selectedFolder])

  // ---------------------------------------------------------------------------
  // Copy URL
  // ---------------------------------------------------------------------------

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url)
    toast.success("URL copied to clipboard")
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isEmpty = assets.length === 0 && folders.length === 0

  return (
    <div className="space-y-6">
      {/* Storage indicator */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Media Library</CardTitle>
                <CardDescription>
                  Upload and manage your files, images, and videos
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewFolderOpen(true)}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatFileSize(usedBytes)} used</span>
            <Separator orientation="vertical" className="h-4" />
            <span>{totalFiles} {totalFiles === 1 ? "file" : "files"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar: breadcrumbs, filter, view toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateToFolder("/")}
            className={`rounded px-2 py-1 transition-colors hover:bg-accent ${
              currentPath === "/" ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            Media
          </button>
          {breadcrumbSegments.map((segment, idx) => {
            const path = "/" + breadcrumbSegments.slice(0, idx + 1).join("/") + "/"
            const isLast = idx === breadcrumbSegments.length - 1
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  onClick={() => navigateToFolder(path)}
                  className={`rounded px-2 py-1 transition-colors hover:bg-accent ${
                    isLast ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {segment}
                </button>
              </span>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <Tabs value={filter} onValueChange={handleFilterChange}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="image">Images</TabsTrigger>
              <TabsTrigger value="video">Videos</TabsTrigger>
              <TabsTrigger value="file">Files</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* View toggle */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Drop zone + content area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative min-h-[300px] rounded-lg border-2 border-dashed transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-transparent"
        }`}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5">
            <div className="text-center">
              <Upload className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-2 text-sm font-medium text-primary">
                Drop files here to upload
              </p>
            </div>
          </div>
        )}

        {isEmpty ? (
          <EmptyState
            onUpload={() => fileInputRef.current?.click()}
            onNewFolder={() => setNewFolderOpen(true)}
          />
        ) : viewMode === "grid" ? (
          <GridView
            folders={folders}
            assets={assets}
            onNavigateFolder={navigateToFolder}
            onCopyUrl={copyUrl}
            onViewDetails={setDetailAsset}
            onDeleteAsset={(asset) => {
              setSelectedAsset(asset)
              setDeleteAssetOpen(true)
            }}
            onDeleteFolder={(folder) => {
              setSelectedFolder(folder)
              setDeleteFolderOpen(true)
            }}
          />
        ) : (
          <ListView
            folders={folders}
            assets={assets}
            onNavigateFolder={navigateToFolder}
            onCopyUrl={copyUrl}
            onViewDetails={setDetailAsset}
            onDeleteAsset={(asset) => {
              setSelectedAsset(asset)
              setDeleteAssetOpen(true)
            }}
            onDeleteFolder={(folder) => {
              setSelectedFolder(folder)
              setDeleteFolderOpen(true)
            }}
          />
        )}
      </div>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in {currentPath === "/" ? "the root" : currentPath}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. marketing"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewFolderOpen(false)
                setNewFolderName("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
            >
              {creatingFolder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete asset dialog */}
      <AlertDialog open={deleteAssetOpen} onOpenChange={setDeleteAssetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedAsset?.name}&quot;?
              This will permanently remove the file and its public URL will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAsset}
              disabled={deletingAsset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAsset ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder dialog */}
      <AlertDialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the folder &quot;{selectedFolder?.name}&quot;?
              The folder must be empty to be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              disabled={deletingFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingFolder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View details dialog */}
      <Dialog open={!!detailAsset} onOpenChange={(open) => { if (!open) setDetailAsset(null) }}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          {detailAsset && (
            <>
              {/* Preview area */}
              <div className="relative flex items-center justify-center bg-muted/50">
                {detailAsset.type === "image" ? (
                  <img
                    src={detailAsset.url}
                    alt={detailAsset.name}
                    className="max-h-64 w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-sm">
                      {detailAsset.type === "video" ? (
                        <Video className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <Badge variant={getTypeBadgeVariant(detailAsset.type)} className="text-xs">
                      {detailAsset.mimeType.split("/")[1]?.toUpperCase() || detailAsset.type.toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="space-y-5 p-6">
                {/* Header */}
                <div>
                  <DialogHeader>
                    <DialogTitle className="truncate text-base" title={detailAsset.name}>
                      {detailAsset.name}
                    </DialogTitle>
                    <DialogDescription>
                      {formatFileSize(detailAsset.size)} · {detailAsset.mimeType} · Uploaded {formatDate(detailAsset.createdAt)}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Type</p>
                    <div className="mt-1">
                      <Badge variant={getTypeBadgeVariant(detailAsset.type)} className="text-xs">
                        {detailAsset.type}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Size</p>
                    <p className="mt-1 font-medium">{formatFileSize(detailAsset.size)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Folder</p>
                    <p className="mt-1 font-mono text-xs">{detailAsset.folder}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Uploaded</p>
                    <p className="mt-1">{formatDate(detailAsset.createdAt)}</p>
                  </div>
                </div>

                {/* Public URL */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Public URL</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-hidden rounded-md border bg-muted/50 px-3 py-2">
                      <code className="block truncate text-xs text-muted-foreground">
                        {detailAsset.url}
                      </code>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => copyUrl(detailAsset.url)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={detailAsset.url} download={detailAsset.name} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      if (detailAsset) {
                        const asset = detailAsset
                        setDetailAsset(null)
                        setTimeout(() => {
                          setSelectedAsset(asset)
                          setDeleteAssetOpen(true)
                        })
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  onUpload,
  onNewFolder,
}: {
  onUpload: () => void
  onNewFolder: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No media files yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Upload images, videos, documents, or any file type. They&apos;ll be available
        via a public URL you can share anywhere.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" onClick={onNewFolder}>
          <FolderPlus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
        <Button onClick={onUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Files
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grid View
// ---------------------------------------------------------------------------

function GridView({
  folders,
  assets,
  onNavigateFolder,
  onCopyUrl,
  onViewDetails,
  onDeleteAsset,
  onDeleteFolder,
}: {
  folders: MediaFolder[]
  assets: MediaAsset[]
  onNavigateFolder: (path: string) => void
  onCopyUrl: (url: string) => void
  onViewDetails: (asset: MediaAsset) => void
  onDeleteAsset: (asset: MediaAsset) => void
  onDeleteFolder: (folder: MediaFolder) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {/* Folders first */}
      {folders.map((folder) => (
        <ContextMenu key={folder.id}>
          <ContextMenuTrigger asChild>
            <div
              className="group relative flex cursor-pointer flex-col items-center rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              onClick={() => onNavigateFolder(folder.path)}
            >
              <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigateFolder(folder.path)
                      }}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteFolder(folder)
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Folder className="h-12 w-12 text-muted-foreground" />
              <span className="mt-2 max-w-full truncate text-sm font-medium">
                {folder.name}
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => onNavigateFolder(folder.path)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => setTimeout(() => onDeleteFolder(folder))}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}

      {/* Assets */}
      {assets.map((asset) => (
        <ContextMenu key={asset.id}>
          <ContextMenuTrigger asChild>
            <div
              className="group relative flex flex-col rounded-lg border bg-card transition-colors hover:bg-accent"
            >
              {/* Thumbnail / icon area */}
              <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-t-lg bg-muted">
                {asset.type === "image" ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {getTypeIcon(asset.type)}
                    <Badge variant={getTypeBadgeVariant(asset.type)} className="text-xs">
                      {asset.mimeType.split("/")[1]?.toUpperCase() || asset.type.toUpperCase()}
                    </Badge>
                  </div>
                )}

                {/* Actions overlay */}
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails(asset)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCopyUrl(asset.url)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy URL
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={asset.url} download={asset.name} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteAsset(asset)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="truncate text-sm font-medium" title={asset.name}>
                  {asset.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatFileSize(asset.size)}
                </p>
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => setTimeout(() => onViewDetails(asset))}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCopyUrl(asset.url)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy URL
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => window.open(asset.url, "_blank")}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => setTimeout(() => onDeleteAsset(asset))}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function ListView({
  folders,
  assets,
  onNavigateFolder,
  onCopyUrl,
  onViewDetails,
  onDeleteAsset,
  onDeleteFolder,
}: {
  folders: MediaFolder[]
  assets: MediaAsset[]
  onNavigateFolder: (path: string) => void
  onCopyUrl: (url: string) => void
  onViewDetails: (asset: MediaAsset) => void
  onDeleteAsset: (asset: MediaAsset) => void
  onDeleteFolder: (folder: MediaFolder) => void
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Folders first */}
          {folders.map((folder) => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger asChild>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => onNavigateFolder(folder.path)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Folder className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{folder.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">Folder</TableCell>
                  <TableCell className="text-muted-foreground">--</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(folder.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onNavigateFolder(folder.path)
                          }}
                        >
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteFolder(folder)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => onNavigateFolder(folder.path)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Open
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => setTimeout(() => onDeleteFolder(folder))}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {/* Assets */}
          {assets.map((asset) => (
            <ContextMenu key={asset.id}>
              <ContextMenuTrigger asChild>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {asset.type === "image" ? (
                        <div className="h-8 w-8 overflow-hidden rounded border bg-muted">
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded border bg-muted">
                          {getTypeIcon(asset.type)}
                        </div>
                      )}
                      <span className="max-w-[300px] truncate font-medium" title={asset.name}>
                        {asset.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeBadgeVariant(asset.type)} className="text-xs">
                      {asset.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(asset.size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(asset.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(asset)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopyUrl(asset.url)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy URL
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={asset.url} download={asset.name} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDeleteAsset(asset)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => setTimeout(() => onViewDetails(asset))}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onCopyUrl(asset.url)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => window.open(asset.url, "_blank")}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => setTimeout(() => onDeleteAsset(asset))}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {folders.length === 0 && assets.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                This folder is empty
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

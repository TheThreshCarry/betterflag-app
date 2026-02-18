"use client"

import { useState } from "react"
import { Image, X, Upload, FileIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaFieldProps {
  value: unknown
  onChange: (value: unknown) => void
  config?: {
    allowedMimeTypes?: string[]
    maxSizeMB?: number
    multiple?: boolean
    mediaSource?: "assets" | "cms" | "both"
  }
  label: string
  description?: string
  required?: boolean
  error?: string
  showValidation?: boolean
  requirements?: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MediaItem = string | { id?: string; url?: string; slug?: string }

function getUrl(item: MediaItem): string | undefined {
  if (typeof item === "string") return item
  if (typeof item === "object" && item !== null) return item.url
  return undefined
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(url)
}

function normalizeToArray(value: unknown): MediaItem[] {
  if (value === null || value === undefined || value === "") return []
  if (Array.isArray(value)) return value as MediaItem[]
  return [value as MediaItem]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaField({
  value,
  onChange,
  config,
  label,
  description,
  required,
  error,
  showValidation,
  requirements = [],
}: MediaFieldProps) {
  const [urlInput, setUrlInput] = useState("")
  const hasError = showValidation && error

  const multiple = config?.multiple ?? false
  const items = normalizeToArray(value)

  // ------- actions -------

  function addUrl(url: string) {
    if (!url.trim()) return
    if (multiple) {
      onChange([...items, url.trim()])
    } else {
      onChange(url.trim())
    }
    setUrlInput("")
  }

  function removeItem(index: number) {
    if (!multiple) {
      onChange(undefined)
      return
    }
    const next = items.filter((_, i) => i !== index)
    onChange(next.length === 0 ? undefined : next)
  }

  function clearAll() {
    onChange(undefined)
    setUrlInput("")
  }

  // ------- render helpers -------

  function renderPreview(item: MediaItem, index: number) {
    const url = getUrl(item)
    return (
      <div
        key={index}
        className="group relative flex items-center gap-2 rounded-md border bg-muted/40 p-2"
      >
        {url && isImageUrl(url) ? (
          <img
            src={url}
            alt={`Media ${index + 1}`}
            className="h-16 w-16 rounded object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {url ?? JSON.stringify(item)}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => removeItem(index)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove</span>
        </Button>
      </div>
    )
  }

  // ------- main render -------

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

      {hasError ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {description}
          {requirements.length > 0 && (
            <span className="text-muted-foreground/70"> [{requirements.join(" • ")}]</span>
          )}
        </p>
      )}

      {/* Previews */}
      {items.length > 0 && (
        <div className="space-y-2">{items.map(renderPreview)}</div>
      )}

      {/* Dropzone placeholder */}
      {(multiple || items.length === 0) && (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-6",
            "text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30"
          )}
        >
          <Image className="h-8 w-8" />
          <span className="text-sm">Click to add media or paste a URL</span>
        </div>
      )}

      {/* Manual URL input */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Paste a media URL..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addUrl(urlInput)
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!urlInput.trim()}
          onClick={() => addUrl(urlInput)}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Metadata line */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {config?.allowedMimeTypes && config.allowedMimeTypes.length > 0 && (
          <span>Allowed: {config.allowedMimeTypes.join(", ")}</span>
        )}
        {config?.maxSizeMB != null && (
          <span>Max size: {config.maxSizeMB} MB</span>
        )}
      </div>

      {/* Clear button */}
      {items.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={clearAll}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}

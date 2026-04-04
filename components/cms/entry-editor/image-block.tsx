"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { mergeAttributes, type Editor } from "@tiptap/core"
import TiptapImage from "@tiptap/extension-image"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Download,
  Trash2,
  Maximize2,
  ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// ---------------------------------------------------------------------------
// ImageBlock Extension
// ---------------------------------------------------------------------------

export const ImageBlock = TiptapImage.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-width") || null,
        renderHTML: (attrs) =>
          attrs.width ? { "data-width": attrs.width } : {},
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      {
        "data-align": HTMLAttributes["data-align"] || "center",
        class: "image-block",
      },
      ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView)
  },
})

// ---------------------------------------------------------------------------
// React Node View
// ---------------------------------------------------------------------------

function ImageBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const { src, alt, title, align, width } = node.attrs
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [imgNaturalWidth, setImgNaturalWidth] = useState(0)
  const [currentWidth, setCurrentWidth] = useState<number | null>(
    width ? Number(width) : null
  )
  const [showAltInput, setShowAltInput] = useState(false)
  const [altValue, setAltValue] = useState(alt || "")
  const [embedOpen, setEmbedOpen] = useState(false)
  const [embedUrl, setEmbedUrl] = useState("")

  useEffect(() => {
    setAltValue(alt || "")
  }, [alt])

  const justify =
    align === "left"
      ? "justify-start"
      : align === "right"
        ? "justify-end"
        : "justify-center"

  const handleLoad = useCallback(() => {
    if (imgRef.current) {
      setImgNaturalWidth(imgRef.current.naturalWidth)
      if (!currentWidth) {
        setCurrentWidth(
          Math.min(imgRef.current.naturalWidth, imgRef.current.parentElement?.clientWidth || 700)
        )
      }
    }
  }, [currentWidth])

  // Resize via drag
  const startResize = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      const startX = e.clientX
      const startWidth = currentWidth || imgRef.current?.clientWidth || 400

      const onMove = (ev: MouseEvent) => {
        const delta = direction === "right" ? ev.clientX - startX : startX - ev.clientX
        const newWidth = Math.max(100, startWidth + delta * 2)
        setCurrentWidth(newWidth)
      }

      const onUp = () => {
        setIsResizing(false)
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        const finalWidth =
          currentWidth || imgRef.current?.clientWidth || startWidth
        updateAttributes({ width: String(Math.round(finalWidth)) })
      }

      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    },
    [currentWidth, updateAttributes]
  )

  const handleDownload = useCallback(() => {
    if (!src) return
    const a = document.createElement("a")
    a.href = src
    a.download = title || alt || "image"
    a.target = "_blank"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [src, title, alt])

  const saveAlt = useCallback(() => {
    updateAttributes({ alt: altValue })
    setShowAltInput(false)
  }, [altValue, updateAttributes])

  if (!src) {
    return (
      <NodeViewWrapper className="relative my-4" data-drag-handle>
        <div 
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const file = e.dataTransfer.files?.[0]
            if (file && file.type.startsWith("image/")) {
              const reader = new FileReader()
              reader.onload = () => updateAttributes({ src: reader.result as string })
              reader.readAsDataURL(file)
            }
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-3">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.accept = "image/*"
                  input.onchange = () => {
                    const file = input.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = () => updateAttributes({ src: reader.result as string })
                      reader.readAsDataURL(file)
                    }
                  }
                  input.click()
                }}
              >
                Upload File
              </Button>
              <Popover open={embedOpen} onOpenChange={(open) => {
                setEmbedOpen(open)
                if (!open) setEmbedUrl("")
              }}>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Embed Link
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" side="bottom" align="center">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Paste an image URL
                  </p>
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="https://example.com/image.png"
                      value={embedUrl}
                      onChange={(e) => setEmbedUrl(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === "Enter" && embedUrl) {
                          updateAttributes({ src: embedUrl })
                          setEmbedOpen(false)
                          setEmbedUrl("")
                        }
                        if (e.key === "Escape") {
                          setEmbedOpen(false)
                          setEmbedUrl("")
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={!embedUrl}
                      onClick={() => {
                        if (embedUrl) {
                          updateAttributes({ src: embedUrl })
                          setEmbedOpen(false)
                          setEmbedUrl("")
                        }
                      }}
                    >
                      Embed
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xs text-muted-foreground">
              or drag and drop an image
            </p>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      className={`relative my-4 flex ${justify}`}
      data-drag-handle
    >
      <div
        ref={containerRef}
        className={`group relative inline-block ${
          selected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg"
            : ""
        }`}
        style={{ width: currentWidth ? `${currentWidth}px` : undefined }}
      >
        {/* Floating toolbar */}
        {selected && (
          <div className="absolute -top-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md">
            <ToolbarBtn
              active={align === "left"}
              onClick={() => updateAttributes({ align: "left" })}
              label="Align left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              active={align === "center"}
              onClick={() => updateAttributes({ align: "center" })}
              label="Align center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              active={align === "right"}
              onClick={() => updateAttributes({ align: "right" })}
              label="Align right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </ToolbarBtn>

            <span className="mx-0.5 h-4 w-px bg-border" />

            <ToolbarBtn onClick={handleDownload} label="Download">
              <Download className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => setShowAltInput((v) => !v)}
              label="Alt text"
              active={showAltInput}
            >
              <span className="text-[10px] font-bold leading-none">ALT</span>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => {
                const maxW = containerRef.current?.parentElement?.clientWidth || 700
                const newWidth = currentWidth === maxW ? imgNaturalWidth : maxW
                setCurrentWidth(Math.min(newWidth, maxW))
                updateAttributes({ width: String(Math.round(Math.min(newWidth, maxW))) })
              }}
              label="Full width"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </ToolbarBtn>

            <span className="mx-0.5 h-4 w-px bg-border" />

            <ToolbarBtn
              onClick={deleteNode}
              label="Delete image"
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
          </div>
        )}

        {/* Alt text input */}
        {selected && showAltInput && (
          <div className="absolute -bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border bg-popover px-2 py-1.5 shadow-md">
            <input
              type="text"
              value={altValue}
              onChange={(e) => setAltValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveAlt()
                if (e.key === "Escape") setShowAltInput(false)
                e.stopPropagation()
              }}
              placeholder="Alt text..."
              className="h-6 w-48 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={saveAlt}
              className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        )}

        {/* Image */}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ""}
          title={title || undefined}
          onLoad={handleLoad}
          className="block h-auto max-w-full rounded-lg"
          style={{ width: "100%" }}
          draggable={false}
        />

        {/* Resize handles (visible on hover or selection) */}
        {selected && (
          <>
            <div
              role="separator"
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-col-resize"
              onMouseDown={(e) => startResize(e, "left")}
            >
              <div className="h-12 w-1.5 rounded-full bg-primary/80 transition-colors hover:bg-primary" />
            </div>
            <div
              role="separator"
              className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-col-resize"
              onMouseDown={(e) => startResize(e, "right")}
            >
              <div className="h-12 w-1.5 rounded-full bg-primary/80 transition-colors hover:bg-primary" />
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ---------------------------------------------------------------------------
// Mini toolbar button
// ---------------------------------------------------------------------------

function ToolbarBtn({
  children,
  onClick,
  label,
  active,
  className = "",
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      } ${className}`}
    >
      {children}
    </button>
  )
}

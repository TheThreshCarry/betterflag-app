"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useEditor, EditorContent } from "@tiptap/react"
import DragHandle from "@tiptap/extension-drag-handle-react"
import { BubbleMenu } from "@tiptap/react/menus"
import type { JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import TiptapLink from "@tiptap/extension-link"
import TiptapUnderline from "@tiptap/extension-underline"
import Emoji from "@tiptap/extension-emoji"
import Image from "@tiptap/extension-image"
import {
  ArrowLeft,
  Save,
  Send,
  Rocket,
  CloudOff,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TextQuote,
  Minus,
  CheckSquare,
  Undo2,
  Redo2,
  CodeSquare,
  ImageIcon,
  Upload,
  Link,
  Plus,
  GripVertical,
} from "lucide-react"
import { toast } from "sonner"
import semver from "semver"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { Changelog, ChangelogLabel } from "@/lib/db/schema"
import {
  createChangelog,
  updateChangelog,
  publishChangelog,
  deployChangelog,
  undeployChangelog,
  assignLabelsToChangelog,
} from "@/lib/actions/changelogs"

interface ChangelogEditorProps {
  changelog?: Changelog | null
  labels: ChangelogLabel[]
  assignedLabelIds?: string[]
}

const defaultContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [],
    },
  ],
}

export function ChangelogEditor({
  changelog,
  labels,
  assignedLabelIds = [],
}: ChangelogEditorProps) {
  const router = useRouter()
  const isEditing = !!changelog

  const [title, setTitle] = useState(changelog?.title || "")
  const [version, setVersion] = useState(changelog?.version || "")
  const [summary, setSummary] = useState(changelog?.summary || "")
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(assignedLabelIds)
  const [content, setContent] = useState<JSONContent>(
    (changelog?.content as JSONContent) || defaultContent
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isDeployed, setIsDeployed] = useState(!!changelog?.deployedAt)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageTab, setImageTab] = useState<string>("url")
  const [isDragging, setIsDragging] = useState(false)
  const hoveredNodePosRef = useRef<number>(-1)
  const handleNodeChange = useCallback(({ pos }: { pos: number }) => {
    hoveredNodePosRef.current = pos
  }, [])
  const dragHandlePositionConfig = useMemo(() => ({
    placement: "left" as const,
    strategy: "absolute" as const,
  }), [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isVersionValid = !version || semver.valid(version) !== null

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    const base64 = await fileToBase64(file)
    setImagePreview(base64)
    setImageUrl("")
  }

  function resetImageDialog() {
    setImageUrl("")
    setImagePreview(null)
    setImageTab("url")
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: { class: "list-disc list-outside ml-4" },
        },
        orderedList: {
          HTMLAttributes: { class: "list-decimal list-outside ml-4" },
        },
        listItem: {
          HTMLAttributes: { class: "leading-relaxed" },
        },
        blockquote: {
          HTMLAttributes: { class: "border-l-4 border-primary pl-4 italic" },
        },
        codeBlock: {
          HTMLAttributes: {
            class: "rounded-md bg-muted p-4 font-mono text-sm",
          },
        },
        code: {
          HTMLAttributes: {
            class: "rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm",
            spellcheck: "false",
          },
        },
        heading: {
          levels: [1, 2, 3],
        },
        dropcursor: {
          color: "#2563EB",
          width: 3,
          class: "ProseMirror-dropcursor border-none",
        },
      }),
      TiptapLink.configure({
        HTMLAttributes: {
          class:
            "text-primary underline underline-offset-[3px] cursor-pointer transition-colors",
        },
        openOnClick: false,
      }),
      TiptapUnderline,
      TaskList.configure({
        HTMLAttributes: { class: "not-prose pl-2" },
      }),
      TaskItem.configure({
        HTMLAttributes: { class: "flex items-start gap-2 my-1" },
        nested: true,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `Heading ${node.attrs.level}`
          }
          return "Start writing your changelog..."
        },
        includeChildren: true,
      }),
      Emoji.configure({
        enableEmoticons: true,
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-md max-w-full h-auto",
        },
        allowBase64: true,
      }),
    ],
    content: (changelog?.content as JSONContent) || defaultContent,
    editorProps: {
      attributes: {
        class: "outline-none min-h-[360px] px-4 py-3",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return false
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = reader.result as string
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({ src: base64 })
                )
              )
            }
            reader.readAsDataURL(file)
            return true
          }
        }
        return false
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files?.length) return false
        const file = files[0]
        if (!file.type.startsWith("image/")) return false
        event.preventDefault()
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })
          if (coordinates) {
            view.dispatch(
              view.state.tr.insert(
                coordinates.pos,
                view.state.schema.nodes.image.create({ src: base64 })
              )
            )
          }
        }
        reader.readAsDataURL(file)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      setContent(editor.getJSON())
    },
    immediatelyRender: false,
  })

  function insertImage() {
    if (!editor) return
    const src = imagePreview || imageUrl
    if (!src) return
    editor.chain().focus().setImage({ src }).run()
    setImageDialogOpen(false)
    setImageUrl("")
    setImagePreview(null)
  }

  function validateBeforeSave(): boolean {
    if (!title.trim()) {
      toast.error("Title is required")
      return false
    }
    if (version && !semver.valid(version)) {
      toast.warning(
        `"${version}" is not a valid semver version. Expected format: 1.0.0, 2.1.3-beta.1, etc.`
      )
      return false
    }
    return true
  }

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    )
  }

  const handleSave = async () => {
    if (!validateBeforeSave()) return

    setIsSaving(true)
    try {
      if (isEditing) {
        await updateChangelog(changelog.id, {
          title,
          version: version || null,
          summary: summary || null,
          content,
        })
        await assignLabelsToChangelog(changelog.id, selectedLabelIds)
        toast.success("Changelog saved")
      } else {
        const entry = await createChangelog({
          title,
          version: version || null,
          summary: summary || null,
          content,
          status: "draft",
        })
        // test this is so good ( -> {} -> {}ø )
        await assignLabelsToChangelog(entry.id, selectedLabelIds)
        toast.success("Changelog created")
        router.push(`/dashboard/changelogs/${entry.id}/edit`)
      }
    } catch {
      toast.error("Failed to save changelog")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!validateBeforeSave()) return

    setIsPublishing(true)
    try {
      if (isEditing) {
        await updateChangelog(changelog.id, {
          title,
          version: version || null,
          summary: summary || null,
          content,
        })
        await assignLabelsToChangelog(changelog.id, selectedLabelIds)
        await publishChangelog(changelog.id)
        toast.success("Changelog published!")
        router.push("/dashboard/changelogs")
      } else {
        const entry = await createChangelog({
          title,
          version: version || null,
          summary: summary || null,
          content,
          status: "draft",
        })
        await assignLabelsToChangelog(entry.id, selectedLabelIds)
        await publishChangelog(entry.id)
        toast.success("Changelog published!")
        router.push("/dashboard/changelogs")
      }
    } catch {
      toast.error("Failed to publish changelog")
    } finally {
      setIsPublishing(false)
    }
  }

  const handleDeploy = async () => {
    if (!isEditing) return
    setIsDeploying(true)
    try {
      await deployChangelog(changelog.id)
      setIsDeployed(true)
      toast.success("Version deployed — this is now the live version")
    } catch {
      toast.error("Failed to deploy version")
    } finally {
      setIsDeploying(false)
    }
  }

  const handleUndeploy = async () => {
    if (!isEditing) return
    setIsDeploying(true)
    try {
      await undeployChangelog(changelog.id)
      setIsDeployed(false)
      toast.success("Version undeployed")
    } catch {
      toast.error("Failed to undeploy version")
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/changelogs")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Changelogs
        </Button>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving || isPublishing}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Draft"}
                </Button>
              </TooltipTrigger>
              {!title.trim() && (
                <TooltipContent>
                  Title is required to save
                </TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handlePublish}
                  disabled={isSaving || isPublishing}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isPublishing ? "Publishing..." : "Publish"}
                </Button>
              </TooltipTrigger>
              {!title.trim() && (
                <TooltipContent>
                  Title is required to publish
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-1">
            <Input
              placeholder="Release title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold h-14 border-none shadow-none focus-visible:ring-0 px-0 text-foreground placeholder:text-muted-foreground/50 pl-4"
            />
          </div>

          <Card>
            {/* Toolbar */}
            {editor && (
              <div className="border-b px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
                <TooltipProvider delayDuration={300}>
                  <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                    tooltip="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                    tooltip="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive("underline")}
                    tooltip="Underline"
                  >
                    <Underline className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive("strike")}
                    tooltip="Strikethrough"
                  >
                    <Strikethrough className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    isActive={editor.isActive("code")}
                    tooltip="Inline Code"
                  >
                    <Code className="h-4 w-4" />
                  </ToolbarButton>

                  <Separator orientation="vertical" className="mx-1 h-6" />

                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 1 }).run()
                    }
                    isActive={editor.isActive("heading", { level: 1 })}
                    tooltip="Heading 1"
                  >
                    <Heading1 className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                    isActive={editor.isActive("heading", { level: 2 })}
                    tooltip="Heading 2"
                  >
                    <Heading2 className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 3 }).run()
                    }
                    isActive={editor.isActive("heading", { level: 3 })}
                    tooltip="Heading 3"
                  >
                    <Heading3 className="h-4 w-4" />
                  </ToolbarButton>

                  <Separator orientation="vertical" className="mx-1 h-6" />

                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }
                    isActive={editor.isActive("bulletList")}
                    tooltip="Bullet List"
                  >
                    <List className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleOrderedList().run()
                    }
                    isActive={editor.isActive("orderedList")}
                    tooltip="Numbered List"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleTaskList().run()
                    }
                    isActive={editor.isActive("taskList")}
                    tooltip="Task List"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </ToolbarButton>

                  <Separator orientation="vertical" className="mx-1 h-6" />

                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleBlockquote().run()
                    }
                    isActive={editor.isActive("blockquote")}
                    tooltip="Quote"
                  >
                    <TextQuote className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().toggleCodeBlock().run()
                    }
                    isActive={editor.isActive("codeBlock")}
                    tooltip="Code Block"
                  >
                    <CodeSquare className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() =>
                      editor.chain().focus().setHorizontalRule().run()
                    }
                    tooltip="Divider"
                  >
                    <Minus className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => {
                      resetImageDialog()
                      setImageDialogOpen(true)
                    }}
                    tooltip="Image"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </ToolbarButton>

                  <Separator orientation="vertical" className="mx-1 h-6" />

                  <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    tooltip="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    tooltip="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </ToolbarButton>
                </TooltipProvider>
              </div>
            )}

            <CardContent className="p-0">
              {/* Bubble menu for inline formatting */}
              {editor && (
                <BubbleMenu
                  editor={editor}
                  className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md"
                >
                  <Button
                    variant={editor.isActive("bold") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={editor.isActive("italic") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={editor.isActive("underline") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      editor.chain().focus().toggleUnderline().run()
                    }
                  >
                    <Underline className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={editor.isActive("strike") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                  >
                    <Strikethrough className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={editor.isActive("code") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                </BubbleMenu>
              )}

              {/* Editor */}
              {editor && (
                <DragHandle
                  editor={editor}
                  onNodeChange={handleNodeChange}
                  computePositionConfig={dragHandlePositionConfig}
                >
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (!editor) return
                        const pos = hoveredNodePosRef.current
                        if (pos < 0) {
                          editor.chain().focus().insertContent("/").run()
                          return
                        }
                        const node = editor.state.doc.nodeAt(pos)
                        if (!node) return
                        if (node.textContent.length === 0) {
                          editor.chain().focus().setTextSelection(pos + 1).insertContent("/").run()
                        } else {
                          const insertPos = pos + node.nodeSize
                          editor
                            .chain()
                            .focus()
                            .insertContentAt(insertPos, { type: "paragraph" })
                            .insertContent("/")
                            .run()
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <div className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing">
                      <GripVertical className="h-4 w-4" />
                    </div>
                  </div>
                </DragHandle>
              )}
              <div className="group relative">
                <EditorContent
                  editor={editor}
                  className="prose prose-sm dark:prose-invert max-w-none min-h-[400px] [&_.tiptap]:outline-none [&_.tiptap]:min-h-[360px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Release Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  placeholder="e.g. 1.0.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className={
                    version && !isVersionValid
                      ? "border-destructive focus-visible:ring-destructive/50"
                      : ""
                  }
                />
                {version && !isVersionValid && (
                  <p className="text-xs text-destructive">
                    Invalid Version Number. Use format like 1.0.0 or 2.1.3-beta.1
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Input
                  id="summary"
                  placeholder="Brief description of this release"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Short excerpt shown in the changelog list
                </p>
              </div>
            </CardContent>
          </Card>

          {labels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Labels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <Badge
                      key={label.id}
                      variant={
                        selectedLabelIds.includes(label.id)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer transition-colors"
                      style={
                        selectedLabelIds.includes(label.id)
                          ? { backgroundColor: label.color, borderColor: label.color }
                          : { borderColor: label.color, color: label.color }
                      }
                      onClick={() => toggleLabel(label.id)}
                    >
                      {label.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={
                      changelog.status === "published" ? "default" : "outline"
                    }
                  >
                    {changelog.status}
                  </Badge>
                  {isDeployed && (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                      live
                    </Badge>
                  )}
                </div>
                {changelog.publishedAt && (
                  <p className="text-xs text-muted-foreground">
                    Published on{" "}
                    {new Date(changelog.publishedAt).toLocaleDateString()}
                  </p>
                )}
                {changelog.status === "published" && (
                  <div className="pt-1">
                    {isDeployed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleUndeploy}
                        disabled={isDeploying}
                      >
                        <CloudOff className="mr-2 h-4 w-4" />
                        {isDeploying ? "Undeploying..." : "Undeploy"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                        onClick={handleDeploy}
                        disabled={isDeploying}
                      >
                        <Rocket className="mr-2 h-4 w-4" />
                        {isDeploying ? "Deploying..." : "Deploy as Live"}
                      </Button>
                    )}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {isDeployed
                        ? "This version is live for all users"
                        : "Make this the version everyone sees"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Image insert dialog */}
      <Dialog
        open={imageDialogOpen}
        onOpenChange={(open) => {
          setImageDialogOpen(open)
          if (!open) resetImageDialog()
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              const active = document.activeElement
              const isInInput = active?.tagName === "INPUT" && (active as HTMLInputElement).type === "text"
              if (!isInInput) {
                e.preventDefault()
                setImageTab((prev) => (prev === "url" ? "upload" : "url"))
              }
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>
              Add an image from a URL or upload a file from your computer.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={imageTab}
            onValueChange={(value) => {
              setImageTab(value)
              setImageUrl("")
              setImagePreview(null)
              setIsDragging(false)
              if (fileInputRef.current) fileInputRef.current.value = ""
            }}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1">
                <Link className="mr-2 h-4 w-4" />
                URL
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL</Label>
                <Input
                  id="image-url"
                  placeholder="https://example.com/image.png"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value)
                    setImagePreview(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && imageUrl) insertImage()
                  }}
                />
              </div>
              {imageUrl && (
                <div className="rounded-md border bg-muted/50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-h-48 w-full rounded object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                </div>
              )}
            </TabsContent>
            <TabsContent value="upload" className="space-y-4 pt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) await handleFileSelect(file)
                }}
              />
              {imagePreview ? (
                <div className="space-y-3">
                  <div className="rounded-md border bg-muted/50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 w-full rounded object-contain"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setImagePreview(null)
                      setIsDragging(false)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  >
                    Choose a different file
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(true)
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(false)
                  }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) await handleFileSelect(file)
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-muted-foreground/25 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                  }`}
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm font-medium">
                    {isDragging ? "Drop your image here" : "Click or drag & drop an image"}
                  </span>
                  <span className="text-xs">PNG, JPG, GIF, SVG, WebP</span>
                </button>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImageDialogOpen(false)
                resetImageDialog()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={insertImage}
              disabled={!imageUrl && !imagePreview}
            >
              Insert Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Toolbar button                                                     */
/* ------------------------------------------------------------------ */

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  tooltip,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  tooltip: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={isActive ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

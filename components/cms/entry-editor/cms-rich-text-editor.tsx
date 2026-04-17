"use client"

import { useRef, useCallback, useMemo } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import DragHandle from "@tiptap/extension-drag-handle-react"
import { BubbleMenu } from "@tiptap/react/menus"
import type { JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TiptapLink from "@tiptap/extension-link"
import TiptapUnderline from "@tiptap/extension-underline"
import Typography from "@tiptap/extension-typography"
import { ImageBlock } from "./image-block"
import { SlashCommands } from "./slash-commands"
import {
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
  CodeSquare,
  ImageIcon,
  Undo2,
  Redo2,
  Link,
  Video,
  Headphones,
  MessageSquare,
  ChevronDown,
  Type,
  MousePointer2,
  Plus,
  GripVertical,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"

const defaultContent: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [] }],
}

interface CmsRichTextEditorProps {
  value?: JSONContent
  onChange: (value: JSONContent) => void
  placeholder?: string
  headerContent?: React.ReactNode
}

export function CmsRichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  headerContent,
}: CmsRichTextEditorProps) {
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
        heading: { levels: [1, 2, 3] },
        dropcursor: {
          color: "#2563EB",
          width: 3,
          class: "ProseMirror-dropcursor border-none",
        },
      }),
      TiptapLink.configure({
        HTMLAttributes: {
          class: "text-primary underline underline-offset-[3px] cursor-pointer transition-colors",
        },
        openOnClick: false,
      }),
      TiptapUnderline,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return `Heading ${node.attrs.level}`
          return placeholder
        },
        includeChildren: true,
      }),
      ImageBlock.configure({
        allowBase64: true,
      }),
      Typography,
      SlashCommands,
    ],
    content: value || defaultContent,
    editorProps: {
      attributes: {
        class: "outline-none min-h-[400px] text-base leading-relaxed",
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
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON())
    },
    immediatelyRender: false,
  })

  function getCurrentStyle(): string {
    if (!editor) return "Paragraph"
    if (editor.isActive("heading", { level: 1 })) return "Heading 1"
    if (editor.isActive("heading", { level: 2 })) return "Heading 2"
    if (editor.isActive("heading", { level: 3 })) return "Heading 3"
    if (editor.isActive("blockquote")) return "Quote"
    if (editor.isActive("codeBlock")) return "Code Block"
    return "Paragraph"
  }

  const hoveredNodePosRef = useRef<number>(-1)
  const handleNodeChange = useCallback(({ pos }: { pos: number }) => {
    hoveredNodePosRef.current = pos
  }, [])
  const dragHandlePositionConfig = useMemo(
    () => ({
      placement: "left-start" as const,
      strategy: "absolute" as const,
    }),
    []
  )

  const contextBlockPosRef = useRef<number>(-1)

  if (!editor) return null

  function handleAddBlock() {
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
  }

  function resolveBlockPos(event: React.MouseEvent) {
    const coords = { left: event.clientX, top: event.clientY }
    const posInfo = editor?.view.posAtCoords(coords)
    if (!posInfo || !editor) return -1
    const resolved = editor.state.doc.resolve(posInfo.pos)
    return resolved.before(1)
  }

  function deleteBlock() {
    if (!editor) return
    const pos = contextBlockPosRef.current
    if (pos < 0) return
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
  }

  function duplicateBlock() {
    if (!editor) return
    const pos = contextBlockPosRef.current
    if (pos < 0) return
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    const insertPos = pos + node.nodeSize
    editor.chain().focus().insertContentAt(insertPos, node.toJSON()).run()
  }

  function moveBlockUp() {
    if (!editor) return
    const pos = contextBlockPosRef.current
    if (pos <= 0) return
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    const resolved = editor.state.doc.resolve(pos)
    const index = resolved.index(0)
    if (index === 0) return
    const prevNode = editor.state.doc.child(index - 1)
    const prevPos = pos - prevNode.nodeSize
    const { tr } = editor.state
    tr.delete(pos, pos + node.nodeSize)
    tr.insert(prevPos, node)
    editor.view.dispatch(tr)
    contextBlockPosRef.current = prevPos
  }

  function moveBlockDown() {
    if (!editor) return
    const pos = contextBlockPosRef.current
    if (pos < 0) return
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    const resolved = editor.state.doc.resolve(pos)
    const index = resolved.index(0)
    if (index >= editor.state.doc.childCount - 1) return
    const nextNode = editor.state.doc.child(index + 1)
    const { tr } = editor.state
    const afterPos = pos + node.nodeSize + nextNode.nodeSize
    tr.delete(pos, pos + node.nodeSize)
    tr.insert(afterPos - node.nodeSize, node)
    editor.view.dispatch(tr)
    contextBlockPosRef.current = pos + nextNode.nodeSize
  }

  function changeBlockTo(type: string) {
    if (!editor) return
    const pos = contextBlockPosRef.current
    if (pos < 0) return
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    editor.chain().focus().setTextSelection(pos + 1).run()
    switch (type) {
      case "paragraph": editor.chain().focus().setParagraph().run(); break
      case "heading1": editor.chain().focus().toggleHeading({ level: 1 }).run(); break
      case "heading2": editor.chain().focus().toggleHeading({ level: 2 }).run(); break
      case "heading3": editor.chain().focus().toggleHeading({ level: 3 }).run(); break
      case "bulletList": editor.chain().focus().toggleBulletList().run(); break
      case "orderedList": editor.chain().focus().toggleOrderedList().run(); break
      case "blockquote": editor.chain().focus().toggleBlockquote().run(); break
      case "codeBlock": editor.chain().focus().toggleCodeBlock().run(); break
    }
  }

  return (
    <div className="min-w-0">
      {/* Toolbar — align with editor gutter */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background py-1.5">
      <div className="w-full max-w-none pl-12 sm:pl-14 pr-3 flex items-center gap-0.5 flex-wrap">
        <TooltipProvider delayDuration={300}>
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

          <Separator orientation="vertical" className="mx-1.5 h-5" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-sm font-medium">
                Style
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                <Type className="mr-2 h-4 w-4" /> Paragraph
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 className="mr-2 h-4 w-4" /> Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 className="mr-2 h-4 w-4" /> Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                <Heading3 className="mr-2 h-4 w-4" /> Heading 3
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <TextQuote className="mr-2 h-4 w-4" /> Quote
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                <CodeSquare className="mr-2 h-4 w-4" /> Code Block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="mx-1.5 h-5" />

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

          <Separator orientation="vertical" className="mx-1.5 h-5" />

          <ToolbarButton
            onClick={() => {
              const previousUrl = editor.getAttributes("link").href
              const url = window.prompt("URL", previousUrl)
              if (url === null) return
              if (url === "") {
                editor.chain().focus().extendMarkRange("link").unsetLink().run()
                return
              }
              editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
            }}
            isActive={editor.isActive("link")}
            tooltip="Link"
          >
            <Link className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              editor.chain().focus().setImage({ src: "" }).run()
            }}
            tooltip="Image"
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled tooltip="Audio (coming soon)">
            <Headphones className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled tooltip="Video (coming soon)">
            <Video className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => {}} disabled tooltip="Comment (coming soon)">
            <MessageSquare className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1.5 h-5" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            tooltip="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            tooltip="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1.5 h-5" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-sm font-medium">
                Button
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          marks: [{ type: "link", attrs: { href: "https://example.com" } }],
                          text: "Click here",
                        },
                      ],
                    })
                    .run()
                }}
              >
                <MousePointer2 className="mr-2 h-4 w-4" /> Insert Button Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-sm font-medium">
                More
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <Minus className="mr-2 h-4 w-4" /> Horizontal Rule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                <CodeSquare className="mr-2 h-4 w-4" /> Code Block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
      </div>

      {/* Header content (title, subtitle, author) injected by parent */}
      {headerContent}

      {/* Bubble menu */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: e }) => {
          if (e.isActive("image")) return false
          return e.view.state.selection.content().size > 0
        }}
        className="z-40 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md"
      >
        <Button
          variant={editor.isActive("bold") ? "outline" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={editor.isActive("italic") ? "outline" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={editor.isActive("underline") ? "outline" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={editor.isActive("strike") ? "outline" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={editor.isActive("code") ? "outline" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-3.5 w-3.5" />
        </Button>
      </BubbleMenu>

      {/* Drag handle */}
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
              handleAddBlock()
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <div className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      </DragHandle>

      {/* Editor content with block context menu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="w-full max-w-none pl-12 sm:pl-14 pr-3 pb-24 pt-1 group"
            onContextMenu={(e) => {
              contextBlockPosRef.current = resolveBlockPos(e)
            }}
          >
            <EditorContent
              editor={editor}
              className="prose prose-sm dark:prose-invert max-w-none min-h-[60vh] [&_.tiptap]:outline-none [&_.tiptap]:min-h-[400px] [&_.tiptap]:box-border"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Type className="mr-2 h-4 w-4" />
              Change into
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem onClick={() => changeBlockTo("paragraph")}>
                <Type className="mr-2 h-4 w-4" /> Paragraph
              </ContextMenuItem>
              <ContextMenuItem onClick={() => changeBlockTo("heading1")}>
                <Heading1 className="mr-2 h-4 w-4" /> Heading 1
              </ContextMenuItem>
              <ContextMenuItem onClick={() => changeBlockTo("heading2")}>
                <Heading2 className="mr-2 h-4 w-4" /> Heading 2
              </ContextMenuItem>
              <ContextMenuItem onClick={() => changeBlockTo("heading3")}>
                <Heading3 className="mr-2 h-4 w-4" /> Heading 3
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => changeBlockTo("bulletList")}>
                <List className="mr-2 h-4 w-4" /> Bullet List
              </ContextMenuItem>
              <ContextMenuItem onClick={() => changeBlockTo("orderedList")}>
                <ListOrdered className="mr-2 h-4 w-4" /> Ordered List
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => changeBlockTo("blockquote")}>
                <TextQuote className="mr-2 h-4 w-4" /> Quote
              </ContextMenuItem>
              <ContextMenuItem onClick={() => changeBlockTo("codeBlock")}>
                <CodeSquare className="mr-2 h-4 w-4" /> Code Block
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={duplicateBlock}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={moveBlockUp}>
            <ArrowUp className="mr-2 h-4 w-4" />
            Move up
          </ContextMenuItem>
          <ContextMenuItem onClick={moveBlockDown}>
            <ArrowDown className="mr-2 h-4 w-4" />
            Move down
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={deleteBlock}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete block
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

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
          variant={isActive ? "outline" : "ghost"}
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

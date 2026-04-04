"use client"

import { Extension, type Editor } from "@tiptap/core"
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion"
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { createRoot } from "react-dom/client"
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TextQuote,
  Minus,
  CodeSquare,
  Type,
  CheckSquare,
  Search,
  ImageIcon,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

interface Command {
  title: string
  description: string
  icon: React.ReactNode
  command: (editor: Editor) => void
}

const COMMANDS: Command[] = [
  {
    title: "Paragraph",
    description: "Plain text paragraph",
    icon: <Type className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <Heading1 className="h-4 w-4" />,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 className="h-4 w-4" />,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 className="h-4 w-4" />,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    description: "Unordered list of items",
    icon: <List className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    description: "Ordered list of items",
    icon: <ListOrdered className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "Blockquote",
    description: "Indent and quote text",
    icon: <TextQuote className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "Code Block",
    description: "Monospace code block",
    icon: <CodeSquare className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: <Minus className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: "Task List",
    description: "Checkbox task items",
    icon: <CheckSquare className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleTaskList?.().run(),
  },
  {
    title: "Image",
    description: "Upload or embed an image",
    icon: <ImageIcon className="h-4 w-4" />,
    command: (editor) => {
      editor.chain().focus().setImage({ src: "" }).run()
    },
  },
]

// ---------------------------------------------------------------------------
// Command list component
// ---------------------------------------------------------------------------

export interface CommandListRef {
  onKeyDown: (event: KeyboardEvent) => boolean
}

interface CommandListProps {
  items: Command[]
  command: (item: Command) => void
  query: string
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useEffect(() => {
      const container = scrollRef.current
      if (!container) return
      const active = container.querySelector<HTMLButtonElement>(
        `[data-index="${selectedIndex}"]`
      )
      active?.scrollIntoView({ block: "nearest" })
    }, [selectedIndex])

    useImperativeHandle(ref, () => ({
      onKeyDown(event: KeyboardEvent) {
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length)
          return true
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex]
          if (item) command(item)
          return true
        }
        return false
      },
    }))

    return (
      <div className="z-50 w-64 overflow-hidden rounded-xl border bg-popover shadow-xl">
        {/* Search bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-sm text-foreground">
            {query || (
              <span className="text-muted-foreground">Search...</span>
            )}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results found
          </div>
        ) : (
          <div ref={scrollRef} className="max-h-72 overflow-y-auto p-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {items.map((item, index) => (
              <button
                key={item.title}
                data-index={index}
                type="button"
                onClick={() => command(item)}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <p className="font-medium leading-none">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)
CommandList.displayName = "CommandList"

// ---------------------------------------------------------------------------
// Slash Commands Tiptap Extension
// ---------------------------------------------------------------------------

function filterCommands(query: string): Command[] {
  if (!query) return COMMANDS
  const lower = query.toLowerCase()
  return COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower)
  )
}

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        allowedPrefixes: null,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor
          range: { from: number; to: number }
          props: Command
        }) => {
          // Delete the slash + query text, then run the command
          editor.chain().focus().deleteRange(range).run()
          props.command(editor)
        },
      } satisfies Partial<SuggestionOptions>,
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterCommands(query),
        render: () => {
          let container: HTMLDivElement | null = null
          let root: ReturnType<typeof createRoot> | null = null
          let componentRef: CommandListRef | null = null

          type SuggestionProps = {
            items: Command[]
            command: (item: Command) => void
            query: string
            clientRect?: (() => DOMRect | null) | null
          }

          const cleanup = () => {
            if (root) {
              root.unmount()
              root = null
            }
            container?.remove()
            container = null
            componentRef = null
          }

          const position = (rect: DOMRect) => {
            if (!container) return
            container.style.top = `${rect.bottom + window.scrollY + 4}px`
            container.style.left = `${rect.left + window.scrollX}px`
          }

          const renderMenu = (props: SuggestionProps) => {
            if (!root) return
            root.render(
              <CommandList
                ref={(ref) => { componentRef = ref }}
                items={props.items}
                command={(item: Command) => props.command(item)}
                query={props.query}
              />
            )
          }

          return {
            onStart(props: SuggestionProps) {
              container = document.createElement("div")
              container.style.position = "absolute"
              container.style.zIndex = "9999"
              document.body.appendChild(container)
              root = createRoot(container)
              const rect = props.clientRect?.()
              if (rect) position(rect)
              renderMenu(props)
            },

            onUpdate(props: SuggestionProps) {
              const rect = props.clientRect?.()
              if (rect) position(rect)
              renderMenu(props)
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === "Escape") {
                cleanup()
                return true
              }
              return componentRef?.onKeyDown(props.event) ?? false
            },

            onExit() {
              cleanup()
            },
          }
        },
      }),
    ]
  },
})

"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Kbd } from "./kbd"

export interface SearchBarProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  placeholder?: string
  shortcut?: string
  minWidth?: number | string
}

const SearchBar = React.forwardRef<HTMLButtonElement, SearchBarProps>(
  (
    {
      className,
      placeholder = "Search...",
      shortcut = "⌘K",
      minWidth = 220,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-2.5 h-8 rounded-md border-[0.5px] border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-muted-foreground/30",
        className
      )}
      style={{ minWidth }}
      {...props}
    >
      <Search size={13} strokeWidth={1.8} />
      <span className="flex-1 text-left">{placeholder}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  )
)
SearchBar.displayName = "SearchBar"

export { SearchBar }

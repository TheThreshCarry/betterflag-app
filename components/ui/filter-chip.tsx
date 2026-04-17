"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FilterChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  value: string
  active?: boolean
  onRemove?: () => void
}

const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ className, label, value, active, onRemove, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border-[0.5px] px-2.5 py-1.5 text-xs font-medium transition-all",
          active
            ? "border-accent/40 bg-accent-soft text-accent-soft-foreground hover:border-accent/60"
            : "border-border bg-card text-foreground hover:border-muted-foreground/30",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "font-normal",
            active ? "text-accent-soft-foreground/70" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "font-mono font-medium text-[11px] px-1.5 py-0.5 rounded",
            active
              ? "bg-accent/15 text-accent-soft-foreground"
              : "bg-surface-muted text-foreground"
          )}
        >
          {value}
        </span>
        {onRemove && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                onRemove()
              }
            }}
            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            aria-label="Remove filter"
          >
            <X size={10} strokeWidth={2.2} />
          </span>
        )}
      </button>
    )
  }
)
FilterChip.displayName = "FilterChip"

export { FilterChip }

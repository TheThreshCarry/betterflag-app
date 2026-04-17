"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const segmentedVariants = cva(
  "inline-flex items-center rounded-md border-[0.5px] border-border bg-card p-0.5 gap-0.5",
  {
    variants: {
      size: {
        sm: "h-7",
        md: "h-8",
        lg: "h-9",
      },
    },
    defaultVariants: { size: "md" },
  }
)

interface SegmentedControlContextValue {
  value: string
  onChange: (v: string) => void
  size: "sm" | "md" | "lg"
}

const SegmentedControlContext =
  React.createContext<SegmentedControlContextValue | null>(null)

export interface SegmentedControlProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof segmentedVariants> {
  value: string
  onValueChange: (value: string) => void
}

const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ className, size = "md", value, onValueChange, children, ...props }, ref) => {
    return (
      <SegmentedControlContext.Provider
        value={{ value, onChange: onValueChange, size: size ?? "md" }}
      >
        <div
          ref={ref}
          role="tablist"
          className={cn(segmentedVariants({ size }), className)}
          {...props}
        >
          {children}
        </div>
      </SegmentedControlContext.Provider>
    )
  }
)
SegmentedControl.displayName = "SegmentedControl"

export interface SegmentedItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const SegmentedItem = React.forwardRef<HTMLButtonElement, SegmentedItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = React.useContext(SegmentedControlContext)
    if (!ctx) throw new Error("SegmentedItem must be used within SegmentedControl")
    const active = ctx.value === value

    const sizeClasses =
      ctx.size === "sm"
        ? "px-2 text-[11px] [&_svg]:h-3 [&_svg]:w-3"
        : ctx.size === "lg"
          ? "px-3.5 text-sm [&_svg]:h-3.5 [&_svg]:w-3.5"
          : "px-3 text-xs [&_svg]:h-3 [&_svg]:w-3"

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={active}
        onClick={() => ctx.onChange(value)}
        className={cn(
          "inline-flex h-full items-center gap-1.5 rounded-[5px] font-medium transition-all",
          sizeClasses,
          active
            ? "bg-primary text-primary-foreground shadow-flat"
            : "text-muted-foreground hover:text-foreground hover:bg-surface-muted",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
SegmentedItem.displayName = "SegmentedItem"

export { SegmentedControl, SegmentedItem }

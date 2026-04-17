"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * DataRow: polymorphic row component used for flag lists, CMS entries,
 * changelog items, breakdown tables, etc. Customize columns via children +
 * optional `bar` prop for horizontal-bar backgrounds on breakdown rows.
 */
export interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
  bar?: number
  cols?: string
  dense?: boolean
}

const DataRow = React.forwardRef<HTMLDivElement, DataRowProps>(
  ({ className, bar, cols, dense = false, style, children, ...props }, ref) => {
    const mergedStyle = {
      ...style,
      gridTemplateColumns: cols,
    } as React.CSSProperties
    return (
      <div
        ref={ref}
        className={cn(
          "relative grid items-center gap-3 border-b-[0.5px] border-border transition-colors hover:bg-surface",
          dense ? "px-4 py-2" : "px-5 py-2.5",
          "text-[13px]",
          className
        )}
        style={mergedStyle}
        {...props}
      >
        {bar !== undefined && (
          <div
            className="absolute inset-y-0 left-0 bg-accent-soft -z-0"
            style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
            aria-hidden
          />
        )}
        <div className="contents relative z-[1]">{children}</div>
      </div>
    )
  }
)
DataRow.displayName = "DataRow"

const DataTable = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border-[0.5px] border-border bg-card overflow-hidden",
      className
    )}
    {...props}
  />
))
DataTable.displayName = "DataTable"

const DataTableHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between px-5 py-3.5 border-b-[0.5px] border-border",
      className
    )}
    {...props}
  />
))
DataTableHeader.displayName = "DataTableHeader"

const DataTableFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between px-5 py-2.5 border-t-[0.5px] border-border bg-surface text-[11px] font-mono text-muted-foreground",
      className
    )}
    {...props}
  />
))
DataTableFooter.displayName = "DataTableFooter"

export { DataRow, DataTable, DataTableHeader, DataTableFooter }

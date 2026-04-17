"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface NavItemProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  icon?: React.ReactNode
  active?: boolean
  badge?: React.ReactNode
  asChild?: boolean
  disabled?: boolean
}

/**
 * NavItem: the sidebar link. Active state gets a white elevated card
 * and the icon turns orange — the ShipOS signature active treatment.
 */
const NavItem = React.forwardRef<HTMLAnchorElement, NavItemProps>(
  (
    { className, icon, active, badge, children, asChild, disabled, ...props },
    ref
  ) => {
    const shellClassName = cn(
      "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all cursor-pointer",
      active
        ? "bg-card text-foreground shadow-[0_0_0_0.5px_hsl(var(--border)),0_1px_2px_rgba(10,10,10,0.03)]"
        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      disabled && "pointer-events-none opacity-50",
      className
    )

    // Radix Slot requires exactly one React element child — never pass icon/badge
    // as siblings here; callers put icon inside the child (e.g. Link) instead.
    if (asChild) {
      return (
        <Slot
          ref={ref}
          aria-disabled={disabled || undefined}
          className={shellClassName}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <a
        ref={ref}
        aria-disabled={disabled || undefined}
        className={shellClassName}
        {...props}
      >
        {icon && (
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-[15px] [&_svg]:w-[15px] transition-colors",
              active ? "text-accent" : "text-current"
            )}
          >
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">{children}</span>
        {badge !== undefined && <span className="shrink-0">{badge}</span>}
      </a>
    )
  }
)
NavItem.displayName = "NavItem"

const NavSection = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mb-5", className)} {...props} />
))
NavSection.displayName = "NavSection"

const NavLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mb-1.5 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
      className
    )}
    {...props}
  />
))
NavLabel.displayName = "NavLabel"

/** Compact count badge for nav items (e.g. "12" next to Docs). */
export interface NavBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "live"
}
const NavBadge = React.forwardRef<HTMLSpanElement, NavBadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium",
        variant === "default" && "bg-surface-muted text-muted-foreground",
        variant === "accent" && "bg-accent-soft text-accent-soft-foreground",
        variant === "live" &&
          "bg-success-soft text-[hsl(142,76%,22%)] dark:text-[hsl(142,76%,65%)]",
        className
      )}
      {...props}
    >
      {variant === "live" && (
        <span className="h-1 w-1 rounded-full bg-success animate-pulse-dot" />
      )}
      {children}
    </span>
  )
)
NavBadge.displayName = "NavBadge"

export { NavItem, NavSection, NavLabel, NavBadge }

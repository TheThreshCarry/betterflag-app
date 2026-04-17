"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * AppShell: 52px topbar + flexible content area.
 * Used by dashboard, events, and any in-product page.
 */
const AppShell = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "grid h-screen grid-rows-[52px_1fr] overflow-hidden bg-background",
      className
    )}
    {...props}
  />
))
AppShell.displayName = "AppShell"

const AppTopbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "grid grid-cols-[240px_1fr_auto] items-center border-b-[0.5px] border-border bg-background pr-4 z-10",
      className
    )}
    {...props}
  />
))
AppTopbar.displayName = "AppTopbar"

const AppTopbarLeft = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full items-center gap-2.5 border-r-[0.5px] border-border px-4",
      className
    )}
    {...props}
  />
))
AppTopbarLeft.displayName = "AppTopbarLeft"

const AppTopbarCenter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}
  />
))
AppTopbarCenter.displayName = "AppTopbarCenter"

const AppTopbarRight = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
))
AppTopbarRight.displayName = "AppTopbarRight"

/**
 * AppMain: the area below the topbar.
 * columns prop shapes the sidebar layout.
 *  - "single"  → [1fr]
 *  - "sidebar" → [240px 1fr]
 *  - "triple"  → [240px 280px 1fr]  (used by the docs editor)
 */
interface AppMainProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: "single" | "sidebar" | "triple"
}

const AppMain = React.forwardRef<HTMLDivElement, AppMainProps>(
  ({ className, columns = "sidebar", ...props }, ref) => {
    const cols =
      columns === "single"
        ? "grid-cols-1"
        : columns === "triple"
          ? "grid-cols-[240px_280px_1fr] max-[900px]:grid-cols-[220px_1fr] max-[600px]:grid-cols-1"
          : "grid-cols-[240px_1fr] max-[600px]:grid-cols-1"

    return (
      <div
        ref={ref}
        className={cn("grid overflow-hidden", cols, className)}
        {...props}
      />
    )
  }
)
AppMain.displayName = "AppMain"

const AppSidebar = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn(
      "flex flex-col overflow-y-auto border-r-[0.5px] border-border bg-background px-2.5 py-4 max-[600px]:hidden",
      className
    )}
    {...props}
  />
))
AppSidebar.displayName = "AppSidebar"

const AppContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col overflow-hidden bg-card", className)}
    {...props}
  />
))
AppContent.displayName = "AppContent"

export {
  AppShell,
  AppTopbar,
  AppTopbarLeft,
  AppTopbarCenter,
  AppTopbarRight,
  AppMain,
  AppSidebar,
  AppContent,
}

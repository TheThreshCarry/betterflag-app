"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const PageHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <header
    ref={ref}
    className={cn(
      "flex items-start justify-between gap-6 border-b-[0.5px] border-border bg-background px-7 pt-5 pb-4",
      "max-[600px]:px-5 max-[600px]:pt-4",
      className
    )}
    {...props}
  />
))
PageHeader.displayName = "PageHeader"

const PageHeaderLeft = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1 min-w-0", className)}
    {...props}
  />
))
PageHeaderLeft.displayName = "PageHeaderLeft"

const PageHeaderTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3", className)}
    {...props}
  />
))
PageHeaderTitle.displayName = "PageHeaderTitle"

const PageTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn(
      "text-[22px] font-semibold tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
PageTitle.displayName = "PageTitle"

const PageDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
))
PageDescription.displayName = "PageDescription"

const PageHeaderActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 shrink-0", className)}
    {...props}
  />
))
PageHeaderActions.displayName = "PageHeaderActions"

export {
  PageHeader,
  PageHeaderLeft,
  PageHeaderTitle,
  PageTitle,
  PageDescription,
  PageHeaderActions,
}

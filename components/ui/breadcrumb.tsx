import * as React from "react"
import { ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="Breadcrumb"
    className={cn("flex items-center gap-1.5 font-mono text-xs", className)}
    {...props}
  />
))
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.OlHTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn("flex flex-wrap items-center gap-1.5", className)}
    {...props}
  />
))
BreadcrumbList.displayName = "BreadcrumbList"

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("inline-flex items-center", className)} {...props} />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { asChild?: boolean }
>(({ className, asChild, ...props }, ref) => {
  void asChild
  return (
    <a
      ref={ref}
      className={cn(
        "px-1.5 py-0.5 rounded text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer",
        className
      )}
      {...props}
    />
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

const BreadcrumbCurrent = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    aria-current="page"
    className={cn(
      "px-1.5 py-0.5 rounded font-medium text-foreground bg-card shadow-[0_0_0_0.5px_hsl(var(--border))]",
      className
    )}
    {...props}
  />
))
BreadcrumbCurrent.displayName = "BreadcrumbCurrent"

/** Alias for back-compat with existing shadcn `<BreadcrumbPage>` usages. */
const BreadcrumbPage = BreadcrumbCurrent

const BreadcrumbSeparator = ({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) => (
  <span className={cn("text-muted-foreground/50", className)} aria-hidden>
    {children ?? <ChevronRight className="h-3 w-3" />}
  </span>
)

const BreadcrumbEllipsis = ({ className }: { className?: string }) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
  >
    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
    <span className="sr-only">More</span>
  </span>
)

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbCurrent,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}

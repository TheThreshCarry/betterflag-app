import * as React from "react"
import { cn } from "@/lib/utils"

const Kbd = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border-[0.5px] border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </kbd>
))
Kbd.displayName = "Kbd"

export { Kbd }

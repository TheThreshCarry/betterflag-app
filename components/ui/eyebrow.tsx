import * as React from "react"
import { cn } from "@/lib/utils"

export interface EyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  dot?: boolean
  pill?: boolean
}

/**
 * Small heading marker used above section titles.
 * Two visual modes: flat (just text) and pill (bordered container).
 */
const Eyebrow = React.forwardRef<HTMLDivElement, EyebrowProps>(
  ({ className, dot, pill, children, ...props }, ref) => {
    if (pill) {
      return (
        <div
          ref={ref}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border bg-surface-muted px-2.5 py-1 font-mono text-[11px] font-semibold tracking-tight text-foreground",
            className
          )}
          {...props}
        >
          {dot && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          {children}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-accent",
          className
        )}
        {...props}
      >
        {dot && <span className="h-1 w-1 rounded-full bg-accent" />}
        {children}
      </div>
    )
  }
)
Eyebrow.displayName = "Eyebrow"

export { Eyebrow }

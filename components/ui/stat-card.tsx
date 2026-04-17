import * as React from "react"
import { cn } from "@/lib/utils"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  delta?: {
    value: string
    direction: "up" | "down" | "flat"
  }
  spark?: React.ReactNode
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, delta, spark, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-lg border-[0.5px] border-border bg-card px-4 py-3.5 overflow-hidden",
          className
        )}
        {...props}
      >
        <div className="text-[11px] font-medium font-mono text-muted-foreground tracking-tight mb-1.5">
          {label}
        </div>
        <div className="text-2xl font-mono font-semibold tracking-tight text-foreground leading-tight mb-1.5">
          {value}
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-medium",
              delta.direction === "up" &&
                "bg-success-soft text-[hsl(142,76%,22%)] dark:text-[hsl(142,76%,65%)]",
              delta.direction === "down" &&
                "bg-[hsl(0,85%,96%)] text-[hsl(0,70%,38%)] dark:bg-[hsl(0,50%,12%)] dark:text-[hsl(0,85%,75%)]",
              delta.direction === "flat" &&
                "bg-surface-muted text-muted-foreground"
            )}
          >
            {delta.direction === "up" && (
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M5 8V2M2 5l3-3 3 3" />
              </svg>
            )}
            {delta.direction === "down" && (
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M5 2v6M2 5l3 3 3-3" />
              </svg>
            )}
            {delta.value}
          </span>
        )}
        {spark && <div className="absolute right-4 top-3.5 h-5 w-14">{spark}</div>}
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }

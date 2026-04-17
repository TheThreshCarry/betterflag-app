import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * CalloutCard: the signature black card with grid-overlay background
 * used for final CTA sections. Children render above the grid.
 * The grid mask defaults to centered — use `gridPosition` to shift it.
 */
interface CalloutCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gridPosition?: "left" | "center" | "right"
  light?: boolean
}

const CalloutCard = React.forwardRef<HTMLDivElement, CalloutCardProps>(
  ({ className, gridPosition = "center", light, children, ...props }, ref) => {
    const maskPosition =
      gridPosition === "left"
        ? "20% 50%"
        : gridPosition === "right"
          ? "80% 50%"
          : "50% 50%"

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-[18px] p-11",
          light
            ? "bg-surface-muted text-foreground border-[0.5px] border-border"
            : "bg-primary text-primary-foreground",
          className
        )}
        {...props}
      >
        {!light && (
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(hsl(0,0%,10%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,0%,10%) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: `radial-gradient(ellipse 60% 80% at ${maskPosition}, #000 20%, transparent 70%)`,
              WebkitMaskImage: `radial-gradient(ellipse 60% 80% at ${maskPosition}, #000 20%, transparent 70%)`,
            }}
            aria-hidden
          />
        )}
        <div className="relative">{children}</div>
      </div>
    )
  }
)
CalloutCard.displayName = "CalloutCard"

export { CalloutCard }

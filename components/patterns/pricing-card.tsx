import * as React from "react"
import { cn } from "@/lib/utils"

export interface PricingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  price: string
  unit?: string
  description?: string
}

/**
 * PricingCard: landing-page pricing tier card with the orange top rail
 * and meter table at the bottom. Children are rendered below the description.
 */
const PricingCard = React.forwardRef<HTMLDivElement, PricingCardProps>(
  (
    { className, label, price, unit, description, children, ...props },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border-[0.5px] border-border bg-card p-7",
        "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-accent before:to-[hsl(27,96%,67%)]",
        className
      )}
      {...props}
    >
      <div className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
        / {label}
      </div>
      <div className="mb-3 flex items-baseline gap-2 font-mono">
        <span className="text-[38px] font-semibold leading-none tracking-tight text-foreground">
          {price}
        </span>
        {unit && (
          <span className="text-[13px] font-medium text-muted-foreground tracking-tight">
            {unit}
          </span>
        )}
      </div>
      {description && (
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-auto">{children}</div>
    </div>
  )
)
PricingCard.displayName = "PricingCard"

export type PricingMeterProps = React.HTMLAttributes<HTMLDivElement>

const PricingMeter = React.forwardRef<HTMLDivElement, PricingMeterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[10px] bg-surface p-4 font-mono text-[13px]",
        className
      )}
      {...props}
    />
  )
)
PricingMeter.displayName = "PricingMeter"

export interface PricingMeterRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string
  highlight?: boolean
}
const PricingMeterRow = React.forwardRef<HTMLDivElement, PricingMeterRowProps>(
  ({ className, label, value, highlight, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex justify-between py-1 text-muted-foreground first:pt-0 last:pb-0",
        className
      )}
      {...props}
    >
      <span>{label}</span>
      <span
        className={cn(
          "font-medium",
          highlight ? "text-accent" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  )
)
PricingMeterRow.displayName = "PricingMeterRow"

export { PricingCard, PricingMeter, PricingMeterRow }

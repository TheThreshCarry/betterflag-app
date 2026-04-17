import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border-[0.5px] px-2.5 py-0.5 text-[11px] font-medium font-mono tracking-tight transition-colors",
  {
    variants: {
      variant: {
        default: "bg-card border-border text-foreground",
        muted: "bg-surface-muted border-transparent text-muted-foreground",
        accent: "bg-accent-soft border-accent/20 text-accent-soft-foreground",
        accentSolid: "bg-accent border-transparent text-accent-foreground",
        success:
          "bg-success-soft border-success/20 text-[hsl(142,76%,22%)] dark:text-[hsl(142,76%,65%)]",
        dark: "bg-primary border-primary text-primary-foreground",
        outline: "bg-transparent border-border text-foreground",
        destructive:
          "bg-destructive border-transparent text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  pulseDot?: boolean
}

function Badge({
  className,
  variant,
  dot,
  pulseDot,
  children,
  ...props
}: BadgeProps) {
  const dotColor =
    variant === "success"
      ? "bg-success"
      : variant === "dark"
        ? "bg-accent"
        : variant === "accentSolid"
          ? "bg-accent-foreground"
          : variant === "destructive"
            ? "bg-destructive-foreground"
            : "bg-accent"

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {(dot || pulseDot) && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotColor,
            pulseDot && "animate-pulse-dot"
          )}
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }

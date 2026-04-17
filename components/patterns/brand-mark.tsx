import * as React from "react"
import { cn } from "@/lib/utils"

interface BrandMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

/**
 * BrandMark: the geometric black tile with a rotated off-white inner square.
 * Used in top-left corner of nav, footers, and hero badges.
 */
const BrandMark = React.forwardRef<HTMLDivElement, BrandMarkProps>(
  ({ className, size = "md", ...props }, ref) => {
    const dims =
      size === "sm"
        ? { outer: "h-5 w-5 rounded", inner: "h-2 w-2 rounded-sm" }
        : size === "lg"
          ? { outer: "h-8 w-8 rounded-lg", inner: "h-3 w-3 rounded-[3px]" }
          : {
              outer: "h-[26px] w-[26px] rounded-md",
              inner: "h-2.5 w-2.5 rounded-sm",
            }

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex items-center justify-center bg-primary",
          dims.outer,
          className
        )}
        aria-label="ShipOS"
        {...props}
      >
        <div
          className={cn("rotate-45 bg-background", dims.inner)}
          aria-hidden
        />
      </div>
    )
  }
)
BrandMark.displayName = "BrandMark"

const BrandLockup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" | "lg" }
>(({ className, size = "md", ...props }, ref) => {
  const textSize =
    size === "sm" ? "text-[13px]" : size === "lg" ? "text-lg" : "text-[15px]"
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2.5", className)}
      {...props}
    >
      <BrandMark size={size} />
      <span className={cn("font-semibold tracking-tight", textSize)}>
        ShipOS
      </span>
    </div>
  )
})
BrandLockup.displayName = "BrandLockup"

export { BrandMark, BrandLockup }

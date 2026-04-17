"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, ...props }, ref) => {
    if (startIcon || endIcon) {
      return (
        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute left-3 flex items-center justify-center text-muted-foreground pointer-events-none [&_svg]:h-3.5 [&_svg]:w-3.5">
              {startIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex h-9 w-full rounded-md border-[0.5px] border-input bg-card text-foreground text-sm transition-colors",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:border-foreground focus-visible:shadow-[0_0_0_3px_rgba(234,88,12,0.1)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "shadow-flat",
              startIcon ? "pl-9" : "pl-3",
              endIcon ? "pr-9" : "pr-3",
              className
            )}
            ref={ref}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-3 flex items-center justify-center text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
              {endIcon}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border-[0.5px] border-input bg-card px-3 text-sm text-foreground transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground/60",
          "focus-visible:outline-none focus-visible:border-foreground focus-visible:shadow-[0_0_0_3px_rgba(234,88,12,0.1)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "shadow-flat",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

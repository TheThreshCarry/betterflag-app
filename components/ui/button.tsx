"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-px shadow-flat",
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90 hover:-translate-y-px shadow-flat",
        outline:
          "border-[0.5px] border-border bg-card text-foreground hover:bg-surface-muted hover:border-muted-foreground/30 shadow-flat",
        ghost:
          "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
        "accent-soft":
          "bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft/80 border-[0.5px] border-accent/20",
        dashed:
          "border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent hover:border-solid bg-transparent",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-flat",
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg]:h-3 [&_svg]:w-3",
        sm: "h-8 px-3 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
        md: "h-9 px-3.5 text-[13px] [&_svg]:h-3.5 [&_svg]:w-3.5",
        lg: "h-11 px-5 text-sm [&_svg]:h-4 [&_svg]:w-4",
        icon: "h-8 w-8 [&_svg]:h-3.5 [&_svg]:w-3.5",
        "icon-lg": "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

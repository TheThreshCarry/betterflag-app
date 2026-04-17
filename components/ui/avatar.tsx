"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const avatarVariants = cva(
  "relative inline-flex items-center justify-center rounded-full font-mono font-semibold shrink-0 select-none overflow-hidden",
  {
    variants: {
      size: {
        xs: "h-5 w-5 text-[9px]",
        sm: "h-6 w-6 text-[10px]",
        md: "h-8 w-8 text-xs",
        lg: "h-10 w-10 text-sm",
        xl: "h-14 w-14 text-base",
      },
      variant: {
        accent: "bg-accent text-accent-foreground",
        primary: "bg-primary text-primary-foreground",
        muted: "bg-surface-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "accent",
    },
  }
)

export interface AvatarProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
      "children"
    >,
    VariantProps<typeof avatarVariants> {
  initials?: string
  status?: "online" | "away" | "offline"
  src?: string
  alt?: string
  children?: React.ReactNode
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(
  (
    { className, size, variant, initials, status, src, alt, children, ...props },
    ref
  ) => {
    const hasFlatApi = src !== undefined || initials !== undefined
    return (
      <AvatarPrimitive.Root
        ref={ref}
        data-slot="avatar"
        className={cn(avatarVariants({ size, variant }), className)}
        {...props}
      >
        {hasFlatApi ? (
          <>
            {src && (
              <AvatarPrimitive.Image
                src={src}
                alt={alt ?? ""}
                className="aspect-square h-full w-full object-cover"
              />
            )}
            <AvatarPrimitive.Fallback
              delayMs={src ? 200 : 0}
              className="flex h-full w-full items-center justify-center"
            >
              {initials ?? alt?.slice(0, 2).toUpperCase() ?? ""}
            </AvatarPrimitive.Fallback>
          </>
        ) : (
          children
        )}
        {status && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
              status === "online" && "bg-success",
              status === "away" && "bg-accent",
              status === "offline" && "bg-muted-foreground"
            )}
            aria-label={`status: ${status}`}
          />
        )}
      </AvatarPrimitive.Root>
    )
  }
)
Avatar.displayName = "Avatar"

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex h-full w-full items-center justify-center",
        className
      )}
      {...props}
    />
  )
}

export interface AvatarStackProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: VariantProps<typeof avatarVariants>["size"]
  max?: number
}

const AvatarStack = React.forwardRef<HTMLDivElement, AvatarStackProps>(
  ({ className, children, max = 4, ...props }, ref) => {
    const childArray = React.Children.toArray(children).filter(Boolean)
    const visible = childArray.slice(0, max)
    const remaining = childArray.length - visible.length

    return (
      <div
        ref={ref}
        className={cn("flex items-center", className)}
        {...props}
      >
        {visible.map((child, i) => (
          <div
            key={i}
            className={cn(
              "[&>*]:ring-2 [&>*]:ring-background",
              i > 0 && "-ml-2"
            )}
          >
            {child}
          </div>
        ))}
        {remaining > 0 && (
          <div className="-ml-2">
            <Avatar
              variant="muted"
              initials={`+${remaining}`}
              className="ring-2 ring-background"
            />
          </div>
        )}
      </div>
    )
  }
)
AvatarStack.displayName = "AvatarStack"

export { Avatar, AvatarImage, AvatarFallback, AvatarStack, avatarVariants }

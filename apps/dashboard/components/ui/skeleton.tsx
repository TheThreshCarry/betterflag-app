import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // `shrink-0` keeps fixed-width bars from being compressed by flex
        // siblings on first paint (the resize-on-load flicker).
        "animate-pulse shrink-0 rounded-md bg-muted",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }

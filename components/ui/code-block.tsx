import * as React from "react"
import { cn } from "@/lib/utils"

export interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  variant?: "dark" | "terminal"
}

const CodeBlock = React.forwardRef<HTMLPreElement, CodeBlockProps>(
  ({ className, variant = "dark", children, ...props }, ref) => {
    return (
      <pre
        ref={ref}
        className={cn(
          "rounded-lg border-[0.5px] p-4 font-mono text-xs leading-[1.9] overflow-x-auto",
          variant === "dark" && "bg-[#000] border-[#1f1f1f] text-[#fafaf9]",
          variant === "terminal" &&
            "bg-primary border-primary text-primary-foreground",
          className
        )}
        {...props}
      >
        {children}
      </pre>
    )
  }
)
CodeBlock.displayName = "CodeBlock"

/**
 * Semantic span helpers for syntax tokens. Use inside <CodeBlock> for
 * consistent coloring that matches ShipOS landing/dashboard.
 */
const CodeToken = {
  Comment: ({ children }: { children: React.ReactNode }) => (
    <span className="text-[#525252]">{children}</span>
  ),
  Keyword: ({ children }: { children: React.ReactNode }) => (
    <span className="text-[#fdba74]">{children}</span>
  ),
  String: ({ children }: { children: React.ReactNode }) => (
    <span className="text-[#86efac]">{children}</span>
  ),
  Method: ({ children }: { children: React.ReactNode }) => (
    <span className="text-[#fb923c]">{children}</span>
  ),
  Number: ({ children }: { children: React.ReactNode }) => (
    <span className="text-[#fbbf24]">{children}</span>
  ),
  Prop: ({ children }: { children: React.ReactNode }) => (
    <span className="text-[#c4b5fd]">{children}</span>
  ),
  Plain: ({ children }: { children: React.ReactNode }) => (
    <span className="text-[#fafaf9]">{children}</span>
  ),
}

export { CodeBlock, CodeToken }

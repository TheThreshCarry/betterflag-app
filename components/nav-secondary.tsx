import * as React from "react"
import Link from "next/link"
import { type LucideIcon } from "lucide-react"

import { NavItem, NavSection } from "@/components/patterns/nav-item"
import { cn } from "@/lib/utils"

interface NavSecondaryProps extends React.HTMLAttributes<HTMLDivElement> {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
}

export function NavSecondary({ items, className, ...props }: NavSecondaryProps) {
  return (
    <NavSection className={cn("mb-0", className)} {...props}>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavItem key={item.title} asChild>
            <Link href={item.url} className="min-w-0">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-[15px] [&_svg]:w-[15px] text-current">
                <item.icon />
              </span>
              <span className="flex-1 truncate">{item.title}</span>
            </Link>
          </NavItem>
        ))}
      </div>
    </NavSection>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  NavBadge,
  NavItem,
  NavLabel,
  NavSection,
} from "@/components/patterns/nav-item"
import { cn } from "@/lib/utils"

type NavSubItem = {
  title: string
  url: string
  comingSoon?: boolean
}

type NavMainItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  comingSoon?: boolean
  items?: NavSubItem[]
}

export function NavMain({
  items,
  sectionExtra,
}: {
  items: NavMainItem[]
  sectionExtra?: Record<string, React.ReactNode>
}) {
  const pathname = usePathname()

  return (
    <NavSection>
      <NavLabel>Platform</NavLabel>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive =
            !item.comingSoon &&
            (pathname === item.url ||
              pathname.startsWith(item.url + "/") ||
              item.items?.some(
                (sub) =>
                  pathname === sub.url || pathname.startsWith(sub.url + "/")
              ))

          if (item.comingSoon) {
            return (
              <NavItem
                key={item.title}
                icon={<item.icon />}
                disabled
                badge={<NavBadge>Soon</NavBadge>}
              >
                {item.title}
              </NavItem>
            )
          }

          if (!item.items?.length) {
            return (
              <NavItem key={item.title} asChild active={isActive}>
                <Link href={item.url} className="min-w-0">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-[15px] [&_svg]:w-[15px] transition-colors",
                      isActive ? "text-accent" : "text-current"
                    )}
                  >
                    <item.icon />
                  </span>
                  <span className="flex-1 truncate">{item.title}</span>
                </Link>
              </NavItem>
            )
          }

          return (
            <Collapsible key={item.title} defaultOpen={isActive} asChild>
              <div>
                <div className="group/item flex items-stretch gap-1">
                  <NavItem asChild active={isActive} className="flex-1 min-w-0">
                    <Link href={item.url} className="min-w-0">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-[15px] [&_svg]:w-[15px] transition-colors",
                          isActive ? "text-accent" : "text-current"
                        )}
                      >
                        <item.icon />
                      </span>
                      <span className="flex-1 truncate">{item.title}</span>
                    </Link>
                  </NavItem>
                  <CollapsibleTrigger
                    aria-label={`Toggle ${item.title}`}
                    className="flex w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-surface-muted hover:text-foreground [&[data-state=open]>svg]:rotate-90"
                  >
                    <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200" />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
                  <ul className="mt-0.5 ml-5 flex flex-col gap-0.5 border-l-[0.5px] border-border pl-2">
                    {item.items.map((subItem) => {
                      if (subItem.comingSoon) {
                        return (
                          <li key={subItem.title}>
                            <NavItem
                              disabled
                              badge={<NavBadge>Soon</NavBadge>}
                              className="text-[12px] py-1"
                            >
                              {subItem.title}
                            </NavItem>
                          </li>
                        )
                      }

                      const isSubActive =
                        pathname === subItem.url ||
                        pathname.startsWith(subItem.url + "/")

                      return (
                        <li key={subItem.title}>
                          <NavItem
                            asChild
                            active={isSubActive}
                            className="text-[12px] py-1"
                          >
                            <Link href={subItem.url}>{subItem.title}</Link>
                          </NavItem>
                        </li>
                      )
                    })}
                    {sectionExtra?.[item.title] && (
                      <li>{sectionExtra[item.title]}</li>
                    )}
                  </ul>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )
        })}
      </div>
    </NavSection>
  )
}

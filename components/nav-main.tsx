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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

export function NavMain({
  items,
  sectionExtra,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    comingSoon?: boolean
    items?: {
      title: string
      url: string
      comingSoon?: boolean
    }[]
  }[]
  sectionExtra?: Record<string, React.ReactNode>
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // Section is active if the current path starts with the section's url
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
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={`${item.title} (Coming Soon)`}
                  disabled
                  className="opacity-50 cursor-not-allowed"
                >
                  <item.icon />
                  <span>{item.title}</span>
                  <Badge
                    variant="secondary"
                    className="ml-auto h-4 px-1 text-[9px] font-normal leading-none"
                  >
                    Soon
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible key={item.title} asChild defaultOpen={isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRight />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => {
                          if (subItem.comingSoon) {
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  disabled
                                  className="opacity-50 cursor-not-allowed"
                                >
                                  <span>{subItem.title}</span>
                                  <Badge
                                    variant="secondary"
                                    className="ml-auto h-4 px-1 text-[9px] font-normal leading-none"
                                  >
                                    Soon
                                  </Badge>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          }

                          const isSubActive =
                            pathname === subItem.url ||
                            pathname.startsWith(subItem.url + "/")

                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={isSubActive}>
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                      {sectionExtra?.[item.title]}
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

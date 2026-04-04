"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronRight, Database } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import { getContentTypes } from "@/lib/actions/content-types"

interface ContentType {
  id: string
  name: string
}

export function DynamicContentTypeMenu() {
  const pathname = usePathname()
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)

  const isAnyActive = contentTypes.some((ct) => {
    const url = `/dashboard/cms/content-types/${ct.id}/entries`
    return pathname === url || pathname.startsWith(url + "/")
  })

  useEffect(() => {
    getContentTypes()
      .then((types) => {
        setContentTypes(types.map((t) => ({ id: t.id, name: t.name })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <SidebarMenuSkeleton />
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    )
  }

  return (
    <SidebarMenuSub>
      <SidebarMenuSubItem>
        <Collapsible defaultOpen={isAnyActive}>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton className="cursor-pointer pr-1">
              <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1">Content Types</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {contentTypes.length === 0 ? (
              <div className="py-2 pl-6 text-xs text-muted-foreground">
                No content types yet
              </div>
            ) : (
              <SidebarMenuSub>
                {contentTypes.map((ct) => {
                  const url = `/dashboard/cms/content-types/${ct.id}/entries`
                  const isActive =
                    pathname === url || pathname.startsWith(url + "/")

                  return (
                    <SidebarMenuSubItem key={ct.id}>
                      <SidebarMenuSubButton asChild isActive={isActive}>
                        <a href={url}>
                          <span>{ct.name}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )
                })}
              </SidebarMenuSub>
            )}
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  )
}

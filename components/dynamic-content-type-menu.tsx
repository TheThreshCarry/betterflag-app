"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Database } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { NavItem } from "@/components/patterns/nav-item"
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
        const list = types as Array<{ id: string; name: string }>
        setContentTypes(list.map((t) => ({ id: t.id, name: t.name })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="py-2 pl-2 text-[11px] font-mono text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <Collapsible defaultOpen={isAnyActive}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">Content Types</span>
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {contentTypes.length === 0 ? (
          <div className="py-1 pl-6 text-[11px] text-muted-foreground">
            No content types yet
          </div>
        ) : (
          <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l-[0.5px] border-border pl-2">
            {contentTypes.map((ct) => {
              const url = `/dashboard/cms/content-types/${ct.id}/entries`
              const isActive =
                pathname === url || pathname.startsWith(url + "/")

              return (
                <li key={ct.id}>
                  <NavItem
                    asChild
                    active={isActive}
                    className="text-[12px] py-1"
                  >
                    <Link href={url}>{ct.name}</Link>
                  </NavItem>
                </li>
              )
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

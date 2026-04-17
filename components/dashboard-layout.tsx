import React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface BreadcrumbItemShape {
  label: string
  href?: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
  breadcrumbs: BreadcrumbItemShape[]
}

export function DashboardLayout({
  children,
  breadcrumbs,
}: DashboardLayoutProps) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b-[0.5px] border-border bg-background px-5">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink href={item.href}>
                      {item.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-5">{children}</div>
    </>
  )
}

"use client";

import Link from "next/link";

import { NAV_ITEMS } from "@/components/app-sidebar";
import { NavMain } from "@/components/nav-main";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

/**
 * First-load shell. Instead of blanking the whole screen with a global
 * skeleton, we render the *real* sidebar chrome immediately — the logo and the
 * nav links are live and clickable while the workspace loads — and scope the
 * shimmer to only the parts that depend on data we don't have yet (the project
 * switcher, environment chips, the signed-in user, and the page body).
 */
export function AppShellLoading() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            href="/flags"
            className="mb-1 px-2 text-[17px] font-semibold tracking-[-0.01em] group-data-[collapsible=icon]:hidden"
          >
            ShipOS
          </Link>

          {/* Project switcher placeholder — matches the loaded button footprint. */}
          <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:justify-center">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5 group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* Environment chips placeholder. */}
          <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
            <Skeleton className="mb-2 ml-2 h-2.5 w-16" />
            <div className="flex gap-1 px-1">
              <Skeleton className="h-6 w-12 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-12 rounded-md" />
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator className="mx-0" />

        <SidebarContent>
          {/* Real, interactive nav — usable before the workspace finishes loading. */}
          <NavMain items={[...NAV_ITEMS]} />
        </SidebarContent>

        <SidebarFooter>
          {/* Signed-in user placeholder. */}
          <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:justify-center">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5 group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <div className="sticky top-0 z-10">
          <header className="flex h-14 items-center border-b border-line bg-canvas/90 px-8 backdrop-blur">
            <Skeleton className="h-4 w-40" />
          </header>
        </div>
        <main className="mx-auto max-w-5xl flex-1 px-8 py-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

"use client"

import * as React from "react"
import Link from "next/link"

import { BrandLockup } from "@/components/patterns/brand-mark"
import {
  AppTopbar,
  AppTopbarLeft,
  AppTopbarCenter,
  AppTopbarRight,
} from "@/components/patterns/app-shell"
import { SearchBar } from "@/components/ui/search-bar"
import { NavUser } from "@/components/nav-user"
import { ThemeToggle } from "@/components/theme-toggle"

interface AppTopbarContentProps {
  user: {
    name: string
    email: string
    avatar: string
  }
  organization?: {
    name: string
    slug?: string
  } | null
}

function triggerCommandK() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true })
  )
}

export function AppTopbarContent({
  user,
  organization,
}: AppTopbarContentProps) {
  return (
    <AppTopbar>
      <AppTopbarLeft>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <BrandLockup size="md" />
        </Link>
        {organization?.name && (
          <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
            / {organization.slug || organization.name}
          </span>
        )}
      </AppTopbarLeft>
      <AppTopbarCenter>
        <SearchBar
          onClick={triggerCommandK}
          placeholder="Search or jump to…"
          shortcut="⌘K"
          minWidth={280}
        />
      </AppTopbarCenter>
      <AppTopbarRight>
        <ThemeToggle />
        <NavUser user={user} />
      </AppTopbarRight>
    </AppTopbar>
  )
}

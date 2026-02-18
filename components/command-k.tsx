"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  FileText,
  BookOpen,
  Mail,
  Sparkles,
  Flag,
  Megaphone,
  Image,
  BarChart3,
  Settings2,
  FileJson,
  Users,
  Plus,
  ArrowRight,
  Search,
  Loader2,
  Globe,
  Sun,
  Moon,
  Monitor,
  type LucideIcon,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { searchAll, type SearchResult } from "@/lib/actions/search"

// ─── Navigation items ────────────────────────────────────────────────
type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  keywords?: string[]
  comingSoon?: boolean
}

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3, keywords: ["home", "overview"] },
  { title: "CMS", url: "/dashboard/cms", icon: FileText, keywords: ["posts", "articles", "cms", "content"] },
  { title: "Global Configs", url: "/dashboard/configs", icon: FileJson, keywords: ["configuration", "settings", "remote config"] },
  { title: "Customers", url: "/dashboard/customers", icon: Users, keywords: ["users", "people"] },
  { title: "Documentation", url: "/dashboard/docs", icon: BookOpen, keywords: ["docs", "pages", "api docs"] },
  { title: "Newsletters", url: "/dashboard/newsletters", icon: Mail, keywords: ["email", "campaigns"], comingSoon: true },
  { title: "Changelogs", url: "/dashboard/changelogs", icon: Sparkles, keywords: ["releases", "changelog", "versions", "updates"] },
  { title: "Changelog Labels", url: "/dashboard/changelogs/labels", icon: Sparkles, keywords: ["tags", "categories"] },
  { title: "Changelog Subscribers", url: "/dashboard/changelogs/subscribers", icon: Sparkles, keywords: ["followers"] },
  { title: "Feature Flags", url: "/dashboard/flags", icon: Flag, keywords: ["flags", "toggles", "feature toggles", "feature flags"] },
  { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone, keywords: ["banners", "modals", "toasts"] },
  { title: "Media", url: "/dashboard/media", icon: Image, keywords: ["images", "videos", "files", "uploads"] },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3, keywords: ["stats", "metrics", "page views", "events"], comingSoon: true },
  { title: "Settings", url: "/dashboard/settings", icon: Settings2, keywords: ["preferences", "configuration"] },
  { title: "API Keys", url: "/dashboard/settings/api-keys", icon: Settings2, keywords: ["api", "keys", "tokens"] },
  { title: "Team", url: "/dashboard/settings/team", icon: Users, keywords: ["members", "roles", "team"] },
  { title: "Billing", url: "/dashboard/settings/billing", icon: Settings2, keywords: ["subscription", "payment", "plan"] },
]

// ─── Quick create items ──────────────────────────────────────────────
type CreateItem = {
  title: string
  url: string
  icon: LucideIcon
  keywords?: string[]
}

const createItems: CreateItem[] = [
  { title: "New Blog Post", url: "/dashboard/cms", icon: FileText, keywords: ["create post", "new entry", "new blog", "new article"] },
  { title: "New Content Type", url: "/dashboard/cms/content-types?new=true", icon: FileText, keywords: ["create content type", "new schema"] },
  { title: "New Changelog", url: "/dashboard/changelogs/new", icon: Sparkles, keywords: ["create changelog", "new release"] },
  { title: "New Feature Flag", url: "/dashboard/flags?new=true", icon: Flag, keywords: ["create flag", "new toggle"] },
  { title: "New Customer", url: "/dashboard/customers?new=true", icon: Users, keywords: ["create customer", "add customer"] },
  { title: "New Global Config", url: "/dashboard/configs?new=true", icon: FileJson, keywords: ["create config", "new config"] },
]

// ─── Result type icon mapping ────────────────────────────────────────
const typeIcons: Record<SearchResult["type"], LucideIcon> = {
  "feature-flag": Flag,
  "changelog": Sparkles,
  "global-config": FileJson,
  "customer": Users,
  "content-type": FileText,
  "cms-entry": FileText,
}

const typeLabels: Record<SearchResult["type"], string> = {
  "feature-flag": "Feature Flag",
  "changelog": "Changelog",
  "global-config": "Config",
  "customer": "Customer",
  "content-type": "Content Type",
  "cms-entry": "Blog Entry",
}

// ─── Component ───────────────────────────────────────────────────────
export function CommandK() {
  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  // Global keyboard shortcut
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setIsSearching(false)
    }
  }, [open])

  // Debounced search
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.trim().length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchAll(query)
        setResults(searchResults)
      } catch (err) {
        console.error("Search failed:", err)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  const runCommand = React.useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    []
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false}>
      <CommandInput
        placeholder="Type a command or search..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Searching...</span>
            </div>
          ) : query.trim().length > 0 ? (
            "No results found."
          ) : (
            "Type to search..."
          )}
        </CommandEmpty>

        {/* ── Contextual DB search results ─────────────────────────── */}
        {results.length > 0 && (
          <>
            <CommandGroup heading="Search Results">
              {results.map((result) => {
                const Icon = typeIcons[result.type]
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    value={`${result.title} ${result.description || ""} ${result.type}`}
                    onSelect={() => runCommand(() => router.push(result.url))}
                  >
                    <Icon className="mr-2 size-4 shrink-0" />
                    <div className="flex flex-1 items-center gap-2 overflow-hidden">
                      <span className="truncate">{result.title}</span>
                      {result.description && (
                        <span className="text-muted-foreground truncate text-xs">
                          {result.description}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] font-normal">
                      {typeLabels[result.type]}
                    </Badge>
                    {result.meta?.enabled && (
                      <span
                        className={`ml-1 size-2 shrink-0 rounded-full ${
                          result.meta.enabled === "enabled"
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      />
                    )}
                    {result.meta?.status && (
                      <Badge
                        variant={result.meta.status === "published" ? "default" : "outline"}
                        className="ml-1 shrink-0 text-[10px] font-normal"
                      >
                        {result.meta.status}
                      </Badge>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── Quick Actions (Create) ───────────────────────────────── */}
        <CommandGroup heading="Quick Actions">
          {createItems.map((item) => (
            <CommandItem
              key={item.url}
              value={`${item.title} ${(item.keywords || []).join(" ")}`}
              onSelect={() => runCommand(() => router.push(item.url))}
            >
              <Plus className="mr-2 size-4 shrink-0" />
              <span>{item.title}</span>
              <ArrowRight className="text-muted-foreground ml-auto size-3" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* ── Navigation ───────────────────────────────────────────── */}
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.url}
              value={`${item.title} ${(item.keywords || []).join(" ")}`}
              onSelect={() => {
                if (!item.comingSoon) {
                  runCommand(() => router.push(item.url))
                }
              }}
              disabled={item.comingSoon}
              className={item.comingSoon ? "opacity-50" : ""}
            >
              <item.icon className="mr-2 size-4 shrink-0" />
              <span>{item.title}</span>
              {item.comingSoon ? (
                <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] font-normal">
                  Coming Soon
                </Badge>
              ) : (
                <CommandShortcut>
                  <ArrowRight className="size-3" />
                </CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* ── Theme ────────────────────────────────────────────────── */}
        <CommandGroup heading="Theme">
          <CommandItem
            value="light theme mode"
            onSelect={() => runCommand(() => setTheme("light"))}
          >
            <Sun className="mr-2 size-4 shrink-0" />
            <span>Light Mode</span>
            {theme === "light" && (
              <span className="bg-primary ml-auto size-2 shrink-0 rounded-full" />
            )}
          </CommandItem>
          <CommandItem
            value="dark theme mode"
            onSelect={() => runCommand(() => setTheme("dark"))}
          >
            <Moon className="mr-2 size-4 shrink-0" />
            <span>Dark Mode</span>
            {theme === "dark" && (
              <span className="bg-primary ml-auto size-2 shrink-0 rounded-full" />
            )}
          </CommandItem>
          <CommandItem
            value="system theme mode auto"
            onSelect={() => runCommand(() => setTheme("system"))}
          >
            <Monitor className="mr-2 size-4 shrink-0" />
            <span>System</span>
            {theme === "system" && (
              <span className="bg-primary ml-auto size-2 shrink-0 rounded-full" />
            )}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── External Links ───────────────────────────────────────── */}
        <CommandGroup heading="Links">
          <CommandItem
            value="public site website"
            onSelect={() => runCommand(() => window.open("/", "_blank"))}
          >
            <Globe className="mr-2 size-4 shrink-0" />
            <span>Public Site</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="border-t px-3 py-2">
        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">↵</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">esc</kbd>
              Close
            </span>
          </div>
          {isSearching && (
            <Loader2 className="size-3 animate-spin" />
          )}
        </div>
      </div>
    </CommandDialog>
  )
}

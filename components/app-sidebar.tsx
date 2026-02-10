"use client"

import * as React from "react"
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
  Globe,
  LifeBuoy,
  Send,
  Command,
  FileJson,
  Users,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const staticNavData = {
  navMain: [
    {
      title: "Blogs & CMS",
      url: "/dashboard/blogs",
      icon: FileText,
      items: [
        {
          title: "All Posts",
          url: "/dashboard/blogs",
        },
        {
          title: "Categories",
          url: "/dashboard/blogs/categories",
        },
        {
          title: "Authors",
          url: "/dashboard/blogs/authors",
        },
      ],
    },
    {
        title: "Global Configs",
        url: "/dashboard/configs",
        icon: FileJson,
        items: [
          {
            title: "All Configs",
            url: "/dashboard/configs",
          }
        ],
      },
    {
      title: "Customers",
      url: "/dashboard/customers",
      icon: Users,
      items: [
        {
          title: "All Customers",
          url: "/dashboard/customers",
        },
      ],
    },
    {
      title: "Documentation",
      url: "/dashboard/docs",
      icon: BookOpen,
      items: [
        {
          title: "Pages",
          url: "/dashboard/docs",
        },
        {
          title: "Navigation",
          url: "/dashboard/docs/navigation",
        },
        {
          title: "Versions",
          url: "/dashboard/docs/versions",
        },
      ],
    },
    {
      title: "Newsletters",
      url: "/dashboard/newsletters",
      icon: Mail,
      items: [
        {
          title: "Campaigns",
          url: "/dashboard/newsletters",
        },
        {
          title: "Subscribers",
          url: "/dashboard/newsletters/subscribers",
        },
        {
          title: "Templates",
          url: "/dashboard/newsletters/templates",
        },
      ],
    },
    {
      title: "Changelogs",
      url: "/dashboard/changelogs",
      icon: Sparkles,
      items: [
        {
          title: "All Releases",
          url: "/dashboard/changelogs",
        },
        {
          title: "Labels",
          url: "/dashboard/changelogs/labels",
        },
        {
          title: "Subscribers",
          url: "/dashboard/changelogs/subscribers",
        },
      ],
    },
    {
      title: "Feature Flags",
      url: "/dashboard/flags",
      icon: Flag,
      items: [
        {
          title: "All Flags",
          url: "/dashboard/flags",
        },
        {
          title: "Environments",
          url: "/dashboard/flags/environments",
        },
      ],
    },
    {
      title: "Announcements",
      url: "/dashboard/announcements",
      icon: Megaphone,
      items: [
        {
          title: "Banners",
          url: "/dashboard/announcements/banners",
        },
        {
          title: "Modals",
          url: "/dashboard/announcements/modals",
        },
        {
          title: "Toasts",
          url: "/dashboard/announcements/toasts",
        },
      ],
    },
    {
      title: "Media",
      url: "/dashboard/media",
      icon: Image,
      items: [
        {
          title: "Images",
          url: "/dashboard/media/images",
        },
        {
          title: "Videos",
          url: "/dashboard/media/videos",
        },
        {
          title: "Files",
          url: "/dashboard/media/files",
        },
      ],
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: BarChart3,
      items: [
        {
          title: "Overview",
          url: "/dashboard/analytics",
        },
        {
          title: "Page Views",
          url: "/dashboard/analytics/pages",
        },
        {
          title: "Events",
          url: "/dashboard/analytics/events",
        },
      ],
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "/dashboard/settings",
        },
        {
          title: "Emails",
          url: "/dashboard/settings/emails",
        },
        {
          title: "Domains",
          url: "/dashboard/settings/domains",
        },
        {
          title: "Team",
          url: "/dashboard/settings/team",
        },
        {
          title: "API Keys",
          url: "/dashboard/settings/api-keys",
        },
        {
          title: "Billing",
          url: "/dashboard/settings/billing",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Help Center",
      url: "/help",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "/feedback",
      icon: Send,
    },
    {
      title: "Public Site",
      url: "/",
      icon: Globe,
    },
  ],
}

interface DynamicConfig {
  id: string
  slug: string
  name: string
  environment: string
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string
    email: string
    avatar: string
  }
  organization?: {
    name: string
    slug?: string
    logo?: string | null
  } | null
  configs?: DynamicConfig[]
}

export function AppSidebar({ user, organization, ...props }: AppSidebarProps) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {organization?.name || "ShipOS"}
                  </span>
                  <span className="truncate text-xs">
                    {organization?.slug || "Personal"}
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={staticNavData.navMain} />
        <NavSecondary items={staticNavData.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-0">
          <div className="flex-1">
            <NavUser user={user} />
          </div>
          <div className="flex items-center pr-1">
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}


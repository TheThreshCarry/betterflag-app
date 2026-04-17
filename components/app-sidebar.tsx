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
  FileJson,
  Users,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { DynamicContentTypeMenu } from "@/components/dynamic-content-type-menu"
import { AppSidebar as AppSidebarShell } from "@/components/patterns/app-shell"

const staticNavData = {
  navMain: [
    {
      title: "CMS",
      url: "/dashboard/cms",
      icon: FileText,
      items: [
        { title: "Overview", url: "/dashboard/cms" },
        { title: "Categories", url: "/dashboard/cms/categories" },
        { title: "Authors", url: "/dashboard/cms/authors" },
        { title: "Media", url: "/dashboard/cms/media" },
      ],
    },
    {
      title: "Global Configs",
      url: "/dashboard/configs",
      icon: FileJson,
      items: [{ title: "All Configs", url: "/dashboard/configs" }],
    },
    {
      title: "Customers",
      url: "/dashboard/customers",
      icon: Users,
      items: [{ title: "All Customers", url: "/dashboard/customers" }],
    },
    {
      title: "Documentation",
      url: "/dashboard/docs",
      icon: BookOpen,
      items: [
        { title: "Pages", url: "/dashboard/docs" },
        { title: "Navigation", url: "/dashboard/docs/navigation" },
        { title: "Versions", url: "/dashboard/docs/versions" },
      ],
    },
    {
      title: "Newsletters",
      url: "/dashboard/newsletters",
      icon: Mail,
      comingSoon: true,
      items: [
        { title: "Campaigns", url: "/dashboard/newsletters" },
        { title: "Subscribers", url: "/dashboard/newsletters/subscribers" },
        { title: "Templates", url: "/dashboard/newsletters/templates" },
      ],
    },
    {
      title: "Changelogs",
      url: "/dashboard/changelogs",
      icon: Sparkles,
      items: [
        { title: "All Releases", url: "/dashboard/changelogs" },
        { title: "Labels", url: "/dashboard/changelogs/labels" },
        { title: "Subscribers", url: "/dashboard/changelogs/subscribers" },
      ],
    },
    {
      title: "Feature Flags",
      url: "/dashboard/flags",
      icon: Flag,
      items: [
        { title: "All Flags", url: "/dashboard/flags" },
        { title: "Environments", url: "/dashboard/flags/environments" },
      ],
    },
    {
      title: "Announcements",
      url: "/dashboard/announcements",
      icon: Megaphone,
      items: [
        { title: "Banners", url: "/dashboard/announcements/banners" },
        { title: "Modals", url: "/dashboard/announcements/modals" },
        { title: "Toasts", url: "/dashboard/announcements/toasts" },
      ],
    },
    {
      title: "Media",
      url: "/dashboard/media",
      icon: Image,
      items: [{ title: "All Files", url: "/dashboard/media" }],
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: BarChart3,
      comingSoon: true,
      items: [
        { title: "Overview", url: "/dashboard/analytics" },
        { title: "Page Views", url: "/dashboard/analytics/pages" },
        { title: "Events", url: "/dashboard/analytics/events" },
      ],
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings2,
      items: [
        { title: "General", url: "/dashboard/settings" },
        { title: "Profile", url: "/dashboard/settings/profile" },
        { title: "Emails", url: "/dashboard/settings/emails", comingSoon: true },
        { title: "Domains", url: "/dashboard/settings/domains" },
        { title: "Team", url: "/dashboard/settings/team" },
        { title: "API Keys", url: "/dashboard/settings/api-keys" },
        { title: "Billing", url: "/dashboard/settings/billing" },
      ],
    },
  ],
  navSecondary: [
    { title: "Help Center", url: "/help", icon: LifeBuoy },
    { title: "Feedback", url: "/feedback", icon: Send },
    { title: "Public Site", url: "/", icon: Globe },
  ],
}

interface DynamicConfig {
  id: string
  slug: string
  name: string
  environment: string
}

interface AppSidebarProps {
  user?: {
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

export function AppSidebar({
  user: _user,
  organization: _organization,
  configs: _configs,
}: AppSidebarProps) {
  return (
    <AppSidebarShell>
      <NavMain
        items={staticNavData.navMain}
        sectionExtra={{
          CMS: <DynamicContentTypeMenu />,
        }}
      />
      <NavSecondary items={staticNavData.navSecondary} className="mt-auto" />
    </AppSidebarShell>
  )
}

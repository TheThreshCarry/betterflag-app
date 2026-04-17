import {
  Flag,
  Sparkles,
  FileJson,
  Users,
  Image,
  FileText,
  BookOpen,
  Megaphone,
  Mail,
  BarChart3,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface ModuleField {
  name: string
  label: string
  placeholder: string
  required?: boolean
  type?: "text" | "textarea"
}

export interface ModuleConfig {
  id: string
  title: string
  icon: LucideIcon
  description: string
  hasSetup: boolean
  route?: string
  comingSoon?: boolean
  createLabel?: string
  fields?: ModuleField[]
}

export const ONBOARDING_MODULES: ModuleConfig[] = [
  {
    id: "feature-flags",
    title: "Feature Flags",
    icon: Flag,
    description:
      "Control feature rollouts with flags you can toggle instantly without redeploying.",
    hasSetup: true,
    route: "/dashboard/flags",
    createLabel: "Create your first feature flag",
    fields: [
      {
        name: "name",
        label: "Flag Name",
        placeholder: "Dark Mode",
        required: true,
      },
      {
        name: "key",
        label: "Flag Key",
        placeholder: "dark-mode",
        required: true,
      },
      {
        name: "description",
        label: "Description",
        placeholder: "Enable dark mode for all users",
      },
    ],
  },
  {
    id: "changelogs",
    title: "Changelogs",
    icon: Sparkles,
    description:
      "Keep your users informed about new features, improvements, and bug fixes with beautiful release notes.",
    hasSetup: true,
    route: "/dashboard/changelogs",
    createLabel: "Create your first changelog",
    fields: [
      {
        name: "title",
        label: "Title",
        placeholder: "v1.0.0 — Initial Release",
        required: true,
      },
      {
        name: "version",
        label: "Version",
        placeholder: "1.0.0",
      },
      {
        name: "summary",
        label: "Summary",
        placeholder: "Our first release with core features...",
        type: "textarea",
      },
    ],
  },
  {
    id: "global-configs",
    title: "Global Configs",
    icon: FileJson,
    description:
      "Manage remote configuration values that your app can fetch without code changes.",
    hasSetup: true,
    route: "/dashboard/configs",
    createLabel: "Create your first config",
    fields: [
      {
        name: "name",
        label: "Config Name",
        placeholder: "App Settings",
        required: true,
      },
      {
        name: "slug",
        label: "Config Key",
        placeholder: "app-settings",
        required: true,
      },
      {
        name: "description",
        label: "Description",
        placeholder: "General application settings",
      },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    icon: Users,
    description:
      "Track and manage your customer base, segment users, and manage their metadata.",
    hasSetup: true,
    route: "/dashboard/customers",
    createLabel: "Add your first customer",
    fields: [
      {
        name: "name",
        label: "Name",
        placeholder: "Jane Doe",
        required: true,
      },
      {
        name: "email",
        label: "Email",
        placeholder: "jane@example.com",
        required: true,
      },
    ],
  },
  {
    id: "media",
    title: "Media",
    icon: Image,
    description:
      "Upload and organize files, images, and assets in a central media library.",
    hasSetup: true,
    route: "/dashboard/media",
    createLabel: "Create your first folder",
    fields: [
      {
        name: "name",
        label: "Folder Name",
        placeholder: "Assets",
        required: true,
      },
    ],
  },
  {
    id: "cms",
    title: "CMS",
    icon: FileText,
    description:
      "Publish and manage content with a built-in content management system.",
    hasSetup: false,
    route: "/dashboard/cms",
  },
  {
    id: "docs",
    title: "Documentation",
    icon: BookOpen,
    description:
      "Create versioned documentation with structured navigation for your product.",
    hasSetup: false,
    route: "/dashboard/docs",
  },
  {
    id: "announcements",
    title: "Announcements",
    icon: Megaphone,
    description:
      "Display banners, modals, and toasts to communicate with your users in-app.",
    hasSetup: false,
    route: "/dashboard/announcements",
  },
  {
    id: "newsletters",
    title: "Newsletters",
    icon: Mail,
    description: "Send email campaigns and manage subscriber lists.",
    hasSetup: false,
    comingSoon: true,
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    description: "Track page views, events, and user behavior.",
    hasSetup: false,
    comingSoon: true,
  },
]

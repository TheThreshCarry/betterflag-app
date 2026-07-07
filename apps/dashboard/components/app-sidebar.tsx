"use client";

import Link from "next/link";

import { EnvSwitcher } from "@/components/env-switcher";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  BarChart3Icon,
  FlagIcon,
  KeyIcon,
  ScrollTextIcon,
  SettingsIcon,
} from "lucide-react";

export const NAV_ITEMS = [
  { title: "Flags", url: "/flags", icon: FlagIcon },
  { title: "Keys", url: "/keys", icon: KeyIcon },
  { title: "Audit", url: "/audit", icon: ScrollTextIcon },
  { title: "Usage", url: "/usage", icon: BarChart3Icon },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
] as const;

export function AppSidebar({
  userEmail,
  orgName,
  signingOut,
  onSignOut,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userEmail: string | null;
  orgName: string;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link
          href="/flags"
          className="mb-1 px-2 text-[17px] font-semibold tracking-[-0.01em] group-data-[collapsible=icon]:hidden"
        >
          ShipOS
        </Link>
        <ProjectSwitcher />
        <EnvSwitcher />
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        <NavMain items={[...NAV_ITEMS]} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          userEmail={userEmail}
          orgName={orgName}
          signingOut={signingOut}
          onSignOut={onSignOut}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

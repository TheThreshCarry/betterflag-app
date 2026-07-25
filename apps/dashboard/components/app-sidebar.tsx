"use client";

import { EnvSwitcher } from "@/components/env-switcher";
import { Logo } from "@/components/logo";
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
import { FlagIcon, GlobeIcon, SettingsIcon } from "lucide-react";

export const NAV_ITEMS = [
  { title: "Flags", url: "/flags", icon: FlagIcon },
  { title: "Analytics", url: "/analytics", icon: GlobeIcon },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
] as const;

export function AppSidebar({
  userEmail,
  orgName,
  orgLogoUrl,
  signingOut,
  onSignOut,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userEmail: string | null;
  orgName: string;
  orgLogoUrl: string | null;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Logo
          href="/flags"
          size="sm"
          showText
          className="mb-1 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          textClassName="group-data-[collapsible=icon]:hidden"
        />
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
          orgLogoUrl={orgLogoUrl}
          signingOut={signingOut}
          onSignOut={onSignOut}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

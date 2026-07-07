"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";

export function NavUser({
  userEmail,
  orgName,
  signingOut,
  onSignOut,
}: {
  userEmail: string | null;
  orgName: string;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const { isMobile } = useSidebar();
  const initials = (userEmail ?? "U").slice(0, 2).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
              {initials}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{userEmail ?? "Signed in"}</span>
              <span className="truncate text-xs text-muted-foreground">{orgName}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-semibold">
                  {initials}
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{userEmail ?? "Signed in"}</span>
                  <span className="truncate text-xs text-muted-foreground">{orgName}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              onClick={onSignOut}
            >
              <LogOutIcon />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
